from __future__ import annotations

import json
import logging
from typing import Any

from .config import MCP_MAX_TOOL_TIMEOUT_SECONDS
from .logging_config import log_event
from .schemas import JsonRpcError, JsonRpcErrorResponse, JsonRpcRequest, JsonRpcSuccessResponse, ToolDescriptor
from .tool_executor import (
    ToolExecutionError,
    ToolNotImplementedError,
    ToolTimeoutError,
    UnknownToolError,
    execute_tool,
)
from .tool_registry import load_tool_registry


def _error_response(
    rpc_id: str | int | None,
    code: int,
    message: str,
    data: Any = None,
    *,
    request_id: str | None = None,
) -> dict[str, Any]:
    if request_id:
        if data is None:
            data = {"requestId": request_id}
        elif isinstance(data, dict):
            data = {**data, "requestId": request_id}
        else:
            data = {"details": data, "requestId": request_id}

    return JsonRpcErrorResponse(id=rpc_id, error=JsonRpcError(code=code, message=message, data=data)).model_dump(
        exclude_none=True
    )


def _resolve_timeout_seconds(params: dict[str, Any], default_timeout_seconds: float) -> float:
    timeout = params.get("timeoutSeconds", default_timeout_seconds)

    if isinstance(timeout, bool) or not isinstance(timeout, (int, float)):
        raise ValueError("'timeoutSeconds' must be a positive number")
    if timeout <= 0:
        raise ValueError("'timeoutSeconds' must be greater than 0")

    return min(float(timeout), MCP_MAX_TOOL_TIMEOUT_SECONDS)


async def handle_mcp_request(
    payload: dict[str, Any],
    *,
    default_timeout_seconds: float,
    request_id: str,
) -> dict[str, Any]:
    log_event("mcp.protocol.dispatch", request_id=request_id, method=payload.get("method"))

    try:
        request = JsonRpcRequest.model_validate(payload)
    except Exception as exc:  # pydantic validation errors
        log_event(
            "mcp.protocol.invalid_request",
            level=logging.WARNING,
            request_id=request_id,
            details=str(exc),
        )
        return _error_response(None, -32600, "Invalid Request", str(exc), request_id=request_id)

    registry = load_tool_registry()

    if request.method == "tools/list":
        log_event("mcp.tools.list", request_id=request_id, tools_count=len(registry))
        tools = [
            ToolDescriptor(name=t["name"], description=t["description"], inputSchema=t["input_schema"]).model_dump()
            for t in registry
        ]
        return JsonRpcSuccessResponse(id=request.id, result={"tools": tools}).model_dump()

    if request.method == "tools/call":
        params = request.params or {}
        name = params.get("name")
        args = params.get("arguments") or {}

        if not isinstance(name, str) or not name:
            return _error_response(
                request.id,
                -32602,
                "Invalid params: 'name' is required",
                request_id=request_id,
            )
        if not isinstance(args, dict):
            return _error_response(
                request.id,
                -32602,
                "Invalid params: 'arguments' must be an object",
                request_id=request_id,
            )

        try:
            timeout_seconds = _resolve_timeout_seconds(params, default_timeout_seconds)
        except ValueError as exc:
            return _error_response(
                request.id,
                -32602,
                "Invalid params",
                {"reason": str(exc)},
                request_id=request_id,
            )

        log_event(
            "mcp.tools.call.start",
            request_id=request_id,
            tool=name,
            timeout_seconds=timeout_seconds,
        )

        try:
            tool_result = await execute_tool(
                name,
                args,
                registry,
                timeout_seconds=timeout_seconds,
                request_id=request_id,
            )
        except UnknownToolError as exc:
            log_event(
                "mcp.tools.call.error",
                level=logging.WARNING,
                request_id=request_id,
                tool=name,
                error_type="UNKNOWN_TOOL",
                details=str(exc),
            )
            return _error_response(
                request.id,
                -32601,
                "Method not found",
                {"type": "UNKNOWN_TOOL", "details": str(exc)},
                request_id=request_id,
            )
        except ToolNotImplementedError as exc:
            log_event(
                "mcp.tools.call.error",
                level=logging.WARNING,
                request_id=request_id,
                tool=name,
                error_type="TOOL_NOT_IMPLEMENTED",
                details=str(exc),
            )
            return _error_response(
                request.id,
                -32004,
                "Tool not implemented",
                {"type": "TOOL_NOT_IMPLEMENTED", "details": str(exc)},
                request_id=request_id,
            )
        except ToolTimeoutError as exc:
            log_event(
                "mcp.tools.call.error",
                level=logging.WARNING,
                request_id=request_id,
                tool=name,
                error_type="TOOL_TIMEOUT",
                timeout_seconds=exc.timeout_seconds,
            )
            return _error_response(
                request.id,
                -32002,
                "Tool execution timeout",
                {
                    "type": "TOOL_TIMEOUT",
                    "tool": exc.tool_name,
                    "timeoutSeconds": exc.timeout_seconds,
                },
                request_id=request_id,
            )
        except ToolExecutionError as exc:
            log_event(
                "mcp.tools.call.error",
                level=logging.WARNING,
                request_id=request_id,
                tool=name,
                error_type="TOOL_EXECUTION_ERROR",
                details=exc.details,
            )
            return _error_response(
                request.id,
                -32010,
                "Tool execution error",
                {"type": "TOOL_EXECUTION_ERROR", "details": exc.details},
                request_id=request_id,
            )
        except Exception as exc:
            log_event(
                "mcp.tools.call.error",
                level=logging.ERROR,
                request_id=request_id,
                tool=name,
                error_type="INTERNAL_ERROR",
                details=str(exc),
            )
            return _error_response(
                request.id,
                -32603,
                "Internal error",
                {"type": "INTERNAL_ERROR", "details": str(exc)},
                request_id=request_id,
            )

        log_event(
            "mcp.tools.call.success",
            request_id=request_id,
            tool=name,
            is_error=not bool(tool_result.get("success")),
        )

        is_error = not bool(tool_result.get("success"))
        mcp_result = {
            "content": [{"type": "text", "text": json.dumps(tool_result, ensure_ascii=False)}],
            "isError": is_error,
        }
        return JsonRpcSuccessResponse(id=request.id, result=mcp_result).model_dump()

    log_event(
        "mcp.protocol.unknown_method",
        level=logging.WARNING,
        request_id=request_id,
        method=request.method,
    )
    return _error_response(request.id, -32601, f"Method not found: {request.method}", request_id=request_id)
