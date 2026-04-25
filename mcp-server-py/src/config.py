from __future__ import annotations

import os


def _safe_float(env_name: str, default: float) -> float:
    raw = os.getenv(env_name)
    if raw is None:
        return default
    try:
        value = float(raw)
    except ValueError:
        return default
    return value if value > 0 else default


MCP_DEFAULT_TOOL_TIMEOUT_SECONDS = _safe_float("AGENTEC_MCP_TIMEOUT_SECONDS", 20.0)
MCP_MAX_TOOL_TIMEOUT_SECONDS = _safe_float("AGENTEC_MCP_MAX_TIMEOUT_SECONDS", 120.0)
