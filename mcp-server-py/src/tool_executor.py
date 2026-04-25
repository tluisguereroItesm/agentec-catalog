from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path
import sys
import tempfile
from datetime import UTC, datetime
from typing import Any

from .logging_config import log_event
from .tool_registry import ToolDefinition


class UnknownToolError(Exception):
    pass


class ToolNotImplementedError(Exception):
    pass


class ToolTimeoutError(Exception):
    def __init__(self, tool_name: str, timeout_seconds: float):
        super().__init__(f"Tool '{tool_name}' timed out after {timeout_seconds:.2f}s")
        self.tool_name = tool_name
        self.timeout_seconds = timeout_seconds


class ToolExecutionError(Exception):
    def __init__(self, message: str, *, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.details = details or {}


def _validate_required_fields(tool: ToolDefinition, arguments: dict[str, Any]) -> None:
    required = tool.get("input_schema", {}).get("required", [])
    if not isinstance(required, list):
        return

    missing = [field for field in required if field not in arguments or arguments[field] in (None, "")]
    if missing:
        raise ToolExecutionError(
            "Missing required tool arguments",
            details={"missing": missing, "tool": tool["name"]},
        )


async def _execute_web_login_playwright(arguments: dict[str, Any], *, request_id: str) -> dict[str, Any]:
    tool_dir = os.getenv("AGENTEC_TOOLS_DIR", "/app/external-tools")
    py_entrypoint = os.getenv(
        "AGENTEC_WEB_LOGIN_PY_ENTRYPOINT",
        str(Path(tool_dir) / "web-login-playwright-py" / "src" / "main.py"),
    )
    node_wrapper = os.getenv(
        "AGENTEC_WEB_LOGIN_NODE_ENTRYPOINT",
        str(Path(tool_dir) / "web-login-playwright" / "scripts" / "python-wrapper.js"),
    )
    backend_mode = os.getenv("AGENTEC_WEB_LOGIN_BACKEND", "auto").strip().lower()

    if backend_mode not in {"auto", "python", "node"}:
        raise ToolExecutionError(
            "Invalid AGENTEC_WEB_LOGIN_BACKEND",
            details={"allowed": ["auto", "python", "node"], "received": backend_mode},
        )

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as tmp:
        json.dump(arguments, tmp, ensure_ascii=False)
        input_file = tmp.name

    async def _run_cmd(command: list[str], backend_label: str) -> dict[str, Any]:
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()

        stdout_text = stdout.decode("utf-8", errors="replace").strip()
        stderr_text = stderr.decode("utf-8", errors="replace").strip()

        if process.returncode != 0:
            raise ToolExecutionError(
                f"{backend_label} backend failed",
                details={
                    "backend": backend_label,
                    "returncode": process.returncode,
                    "stderr": stderr_text,
                    "stdout": stdout_text,
                },
            )

        try:
            parsed = json.loads(stdout_text.splitlines()[-1])
        except Exception as exc:  # noqa: BLE001
            raise ToolExecutionError(
                "Tool output is not valid JSON",
                details={"backend": backend_label, "stdout": stdout_text, "error": str(exc)},
            ) from exc

        if isinstance(parsed, dict):
            parsed.setdefault("tool", "web_login_playwright")
            parsed.setdefault("timestamp", datetime.now(UTC).isoformat())
            parsed.setdefault("backend", backend_label)
            return parsed

        raise ToolExecutionError(
            "Tool output must be a JSON object",
            details={"backend": backend_label, "stdout": stdout_text},
        )

    async def _python_backend() -> dict[str, Any]:
        if not Path(py_entrypoint).exists():
            raise ToolExecutionError(
                "Python entrypoint not found",
                details={"backend": "python-playwright", "entrypoint": py_entrypoint},
            )
        return await _run_cmd([sys.executable, py_entrypoint, input_file], "python-playwright")

    async def _node_backend() -> dict[str, Any]:
        if not Path(node_wrapper).exists():
            raise ToolExecutionError(
                "Node wrapper not found",
                details={"backend": "node-legacy-wrapper", "entrypoint": node_wrapper},
            )
        return await _run_cmd(["node", node_wrapper, input_file], "node-legacy-wrapper")

    try:
        if backend_mode == "python":
            return await _python_backend()
        if backend_mode == "node":
            return await _node_backend()

        # auto: primero Python, fallback a wrapper Node
        try:
            return await _python_backend()
        except ToolExecutionError as py_exc:
            log_event(
                "mcp.executor.backend_fallback",
                level=logging.WARNING,
                request_id=request_id,
                tool="web_login_playwright",
                from_backend="python-playwright",
                to_backend="node-legacy-wrapper",
                details=py_exc.details,
            )
            return await _node_backend()
    finally:
        try:
            Path(input_file).unlink(missing_ok=True)
        except Exception:  # noqa: BLE001
            pass


async def _execute_python_json_tool(
    *,
    tool_name: str,
    arguments: dict[str, Any],
    request_id: str,
    entrypoint: str,
) -> dict[str, Any]:
    if not Path(entrypoint).exists():
        raise ToolExecutionError(
            f"Python entrypoint not found for {tool_name}",
            details={"tool": tool_name, "entrypoint": entrypoint},
        )

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as tmp:
        json.dump(arguments, tmp, ensure_ascii=False)
        input_file = tmp.name

    try:
        process = await asyncio.create_subprocess_exec(
            sys.executable,
            entrypoint,
            input_file,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        stdout_text = stdout.decode("utf-8", errors="replace").strip()
        stderr_text = stderr.decode("utf-8", errors="replace").strip()

        if process.returncode != 0:
            raise ToolExecutionError(
                f"{tool_name} backend failed",
                details={
                    "tool": tool_name,
                    "entrypoint": entrypoint,
                    "returncode": process.returncode,
                    "stderr": stderr_text,
                    "stdout": stdout_text,
                },
            )

        try:
            parsed = json.loads(stdout_text.splitlines()[-1])
        except Exception as exc:  # noqa: BLE001
            raise ToolExecutionError(
                "Tool output is not valid JSON",
                details={"tool": tool_name, "stdout": stdout_text, "error": str(exc)},
            ) from exc

        if not isinstance(parsed, dict):
            raise ToolExecutionError(
                "Tool output must be a JSON object",
                details={"tool": tool_name, "stdout": stdout_text},
            )

        parsed.setdefault("tool", tool_name)
        parsed.setdefault("timestamp", datetime.now(UTC).isoformat())
        return parsed
    finally:
        try:
            Path(input_file).unlink(missing_ok=True)
        except Exception:  # noqa: BLE001
            pass


async def _run_tool(tool: ToolDefinition, arguments: dict[str, Any], *, request_id: str) -> dict[str, Any]:
    if not tool.get("implemented", False):
        raise ToolNotImplementedError(f"Tool approved but not implemented in Python: {tool['name']}")

    if tool["name"] == "web_login_playwright":
        return await _execute_web_login_playwright(arguments, request_id=request_id)

    tool_dir = os.getenv("AGENTEC_TOOLS_DIR", "/app/external-tools")

    if tool["name"] == "web_login_playwright_py":
        return await _execute_python_json_tool(
            tool_name="web_login_playwright_py",
            arguments=arguments,
            request_id=request_id,
            entrypoint=str(Path(tool_dir) / "web-login-playwright-py" / "src" / "main.py"),
        )

    if tool["name"] == "graph_mail":
        return await _execute_python_json_tool(
            tool_name="graph_mail",
            arguments=arguments,
            request_id=request_id,
            entrypoint=str(Path(tool_dir) / "graph-mail" / "src" / "main.py"),
        )

    if tool["name"] == "graph_files":
        return await _execute_python_json_tool(
            tool_name="graph_files",
            arguments=arguments,
            request_id=request_id,
            entrypoint=str(Path(tool_dir) / "graph-files" / "src" / "main.py"),
        )

    raise ToolNotImplementedError(f"No executor mapped for tool: {tool['name']}")


async def execute_tool(
    tool_name: str,
    arguments: dict[str, Any],
    registry: list[ToolDefinition],
    *,
    timeout_seconds: float,
    request_id: str,
) -> dict[str, Any]:
    selected = next((tool for tool in registry if tool["name"] == tool_name), None)
    if not selected:
        raise UnknownToolError(f"Unknown tool: {tool_name}")

    _validate_required_fields(selected, arguments)

    log_event(
        "mcp.executor.start",
        request_id=request_id,
        tool=tool_name,
        timeout_seconds=timeout_seconds,
        implemented=selected.get("implemented", False),
    )

    try:
        result = await asyncio.wait_for(_run_tool(selected, arguments, request_id=request_id), timeout=timeout_seconds)
        log_event(
            "mcp.executor.finish",
            request_id=request_id,
            tool=tool_name,
            success=bool(result.get("success")),
        )
        return result
    except asyncio.TimeoutError as exc:
        log_event(
            "mcp.executor.timeout",
            level=logging.WARNING,
            request_id=request_id,
            tool=tool_name,
            timeout_seconds=timeout_seconds,
        )
        raise ToolTimeoutError(tool_name, timeout_seconds) from exc
