from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml


def resolve_catalog_root() -> Path:
    env_catalog_dir = os.getenv("CATALOG_DIR")
    if env_catalog_dir:
        return Path(env_catalog_dir).resolve()

    # /agentec-catalog/mcp-server-py/src/catalog_loader.py -> parent[2] = /agentec-catalog
    return Path(__file__).resolve().parents[2]


def load_approved_tools() -> list[dict[str, Any]]:
    catalog_root = resolve_catalog_root()
    tools_yaml = catalog_root / "tools" / "approved-tools.yaml"

    if not tools_yaml.exists():
        raise FileNotFoundError(f"approved-tools.yaml not found at: {tools_yaml}")

    raw = yaml.safe_load(tools_yaml.read_text(encoding="utf-8")) or {}
    approved_tools = raw.get("approved_tools", [])
    if not isinstance(approved_tools, list):
        raise ValueError("Invalid approved-tools.yaml: 'approved_tools' must be a list")

    return [tool for tool in approved_tools if tool.get("status") == "approved"]
