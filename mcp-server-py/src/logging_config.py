from __future__ import annotations

import json
import logging
import os
from datetime import UTC, datetime
from typing import Any


LOGGER_NAME = "agentec.mcp"


def configure_logging() -> logging.Logger:
    logger = logging.getLogger(LOGGER_NAME)
    if logger.handlers:
        return logger

    level_name = os.getenv("AGENTEC_MCP_LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    handler = logging.StreamHandler()
    # El mensaje ya viene serializado como JSON.
    handler.setFormatter(logging.Formatter("%(message)s"))

    logger.addHandler(handler)
    logger.setLevel(level)
    logger.propagate = False
    return logger


def _normalize(value: Any) -> Any:
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, dict):
        return {str(k): _normalize(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_normalize(v) for v in value]
    return str(value)


def log_event(event: str, *, level: int = logging.INFO, **fields: Any) -> None:
    logger = configure_logging()
    payload = {
        "timestamp": datetime.now(UTC).isoformat(),
        "event": event,
        **{k: _normalize(v) for k, v in fields.items()},
    }
    logger.log(level, json.dumps(payload, ensure_ascii=False))
