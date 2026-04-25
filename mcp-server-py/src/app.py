from __future__ import annotations

import logging
import os
import time
from uuid import uuid4
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from .config import MCP_DEFAULT_TOOL_TIMEOUT_SECONDS
from .logging_config import configure_logging, log_event
from .mcp_protocol import handle_mcp_request
from .tool_registry import load_tool_registry

APP_NAME = "agentec-mcp-server-py"
APP_VERSION = "0.1.0"
MCP_AUTH_TOKEN = os.getenv("AGENTEC_MCP_AUTH_TOKEN", "").strip()

app = FastAPI(title=APP_NAME, version=APP_VERSION)
configure_logging()


def _is_authorized(authorization: str | None) -> bool:
    if not MCP_AUTH_TOKEN:
        return True
    if not authorization:
        return False

    expected_bearer = f"Bearer {MCP_AUTH_TOKEN}"
    return authorization == expected_bearer or authorization == MCP_AUTH_TOKEN


@app.get("/health")
def health() -> dict[str, Any]:
    tools = [tool["name"] for tool in load_tool_registry()]
    log_event("mcp.health", server=APP_NAME, tools_count=len(tools))
    return {
        "status": "ok",
        "server": APP_NAME,
        "version": APP_VERSION,
        "tools": tools,
    }


@app.post("/mcp")
async def mcp_endpoint(
    request: Request,
    authorization: str | None = Header(default=None),
    x_request_id: str | None = Header(default=None, alias="X-Request-Id"),
) -> JSONResponse:
    request_id = x_request_id or str(uuid4())
    started_at = time.perf_counter()
    client_host = request.client.host if request.client else None

    log_event(
        "mcp.request.received",
        request_id=request_id,
        path=str(request.url.path),
        client_host=client_host,
        content_type=request.headers.get("content-type"),
    )

    if not _is_authorized(authorization):
        log_event(
            "mcp.request.unauthorized",
            level=logging.WARNING,
            request_id=request_id,
            path=str(request.url.path),
            client_host=client_host,
        )
        unauthorized_payload = {
            "jsonrpc": "2.0",
            "id": None,
            "error": {"code": -32001, "message": "Unauthorized", "data": {"requestId": request_id}},
        }
        response = JSONResponse(status_code=401, content=unauthorized_payload)
        response.headers["X-Request-Id"] = request_id
        return response

    content_type = request.headers.get("content-type", "")
    if "application/json" not in content_type:
        log_event(
            "mcp.request.unsupported_media_type",
            level=logging.WARNING,
            request_id=request_id,
            content_type=content_type,
        )
        response = JSONResponse(
            status_code=415,
            content={
                "jsonrpc": "2.0",
                "id": None,
                "error": {
                    "code": -32000,
                    "message": "Unsupported Media Type",
                    "data": {
                        "requestId": request_id,
                        "details": "Use application/json for MVP endpoint",
                    },
                },
            },
        )
        response.headers["X-Request-Id"] = request_id
        return response

    try:
        payload = await request.json()
    except Exception as exc:
        log_event(
            "mcp.request.parse_error",
            level=logging.WARNING,
            request_id=request_id,
            details=str(exc),
        )
        response = JSONResponse(
            status_code=400,
            content={
                "jsonrpc": "2.0",
                "id": None,
                "error": {
                    "code": -32700,
                    "message": "Parse error",
                    "data": {"requestId": request_id, "details": str(exc)},
                },
            },
        )
        response.headers["X-Request-Id"] = request_id
        return response

    response_payload = await handle_mcp_request(
        payload,
        default_timeout_seconds=MCP_DEFAULT_TOOL_TIMEOUT_SECONDS,
        request_id=request_id,
    )
    duration_ms = round((time.perf_counter() - started_at) * 1000, 2)

    maybe_error = response_payload.get("error")
    log_event(
        "mcp.request.completed",
        level=logging.WARNING if maybe_error else logging.INFO,
        request_id=request_id,
        duration_ms=duration_ms,
        method=payload.get("method"),
        error_code=maybe_error.get("code") if isinstance(maybe_error, dict) else None,
    )

    response = JSONResponse(status_code=200, content=response_payload)
    response.headers["X-Request-Id"] = request_id
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict) and exc.detail.get("jsonrpc") == "2.0":
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "jsonrpc": "2.0",
            "id": None,
            "error": {"code": -32000, "message": str(exc.detail)},
        },
    )
