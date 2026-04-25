from __future__ import annotations

from typing import Any, TypedDict

from .catalog_loader import load_approved_tools


class ToolDefinition(TypedDict):
    name: str
    description: str
    input_schema: dict[str, Any]
    catalog_name: str
    version: str
    owner: str
    implemented: bool


def _to_mcp_name(name: str) -> str:
    return name.replace("-", "_")


# MVP: registramos esquema explícito para web-login-playwright.
MVP_TOOL_DEFINITIONS: dict[str, ToolDefinition] = {
    "web-login-playwright": {
        "name": "web_login_playwright",
        "description": (
            "Executes a browser-based login flow and generates evidence using the reusable site profile model."
        ),
        "input_schema": {
            "type": "object",
            "required": [
                "username",
                "password",
            ],
            "properties": {
                "configProfile": {"type": "string", "description": "Named web-login profile"},
                "configFile": {"type": "string", "description": "Optional profile file override"},
                "url": {"type": "string", "description": "Login page URL"},
                "username": {"type": "string", "description": "Username"},
                "password": {"type": "string", "description": "Password"},
                "usernameSelector": {
                    "type": "string",
                    "description": "CSS selector for username field",
                },
                "passwordSelector": {
                    "type": "string",
                    "description": "CSS selector for password field",
                },
                "submitSelector": {
                    "type": "string",
                    "description": "CSS selector for submit button",
                },
                "successIndicator": {
                    "type": "string",
                    "description": "Selector indicating successful login",
                },
                "headless": {"type": "boolean", "description": "Run headless"},
                "timeoutMs": {"type": "integer", "description": "Timeout in milliseconds"},
            },
        },
        "catalog_name": "web-login-playwright",
        "version": "0.1.0",
        "owner": "equipo-agentec",
        "implemented": True,
    },
    "web-login-playwright-py": {
        "name": "web_login_playwright_py",
        "description": "Executes a browser-based login flow using the Python backend and reusable site profiles.",
        "input_schema": {
            "type": "object",
            "required": ["username", "password"],
            "properties": {
                "configProfile": {"type": "string", "description": "Named web-login profile"},
                "configFile": {"type": "string", "description": "Optional profile file override"},
                "url": {"type": "string", "description": "Login page URL"},
                "username": {"type": "string", "description": "Username"},
                "password": {"type": "string", "description": "Password"},
                "usernameSelector": {"type": "string", "description": "CSS selector for username field"},
                "passwordSelector": {"type": "string", "description": "CSS selector for password field"},
                "submitSelector": {"type": "string", "description": "CSS selector for submit button"},
                "successIndicator": {"type": "string", "description": "Selector indicating successful login"},
                "headless": {"type": "boolean", "description": "Run headless"},
                "timeoutMs": {"type": "integer", "description": "Timeout in milliseconds"},
            },
        },
        "catalog_name": "web-login-playwright-py",
        "version": "0.1.0",
        "owner": "equipo-agentec",
        "implemented": True,
    },
    "graph-mail": {
        "name": "graph_mail",
        "description": "Reads and analyzes Microsoft 365 email through reusable Microsoft Graph tenant profiles.",
        "input_schema": {
            "type": "object",
            "required": ["action"],
            "properties": {
                "action": {"type": "string", "description": "Mail action to execute"},
                "profile": {"type": "string", "description": "Graph profile name"},
                "configFile": {"type": "string", "description": "Optional Graph profile file override"},
                "user": {"type": "string", "description": "Local auth session key"},
                "graphUserId": {"type": "string", "description": "Graph user id override"},
                "top": {"type": "integer", "description": "Max items"},
                "sender": {"type": "string", "description": "Sender filter"},
                "query": {"type": "string", "description": "Search term"},
                "id": {"type": "string", "description": "Message or conversation id"},
                "project": {"type": "string", "description": "Project name"},
                "days": {"type": "integer", "description": "Days back"},
                "period": {"type": "string", "description": "Digest period"},
                "tenantIdOverride": {"type": "string", "description": "Tenant override"},
                "clientIdOverride": {"type": "string", "description": "Client id override"},
            },
        },
        "catalog_name": "graph-mail",
        "version": "0.1.0",
        "owner": "equipo-agentec",
        "implemented": True,
    },
    "graph-files": {
        "name": "graph_files",
        "description": "Reads and summarizes OneDrive or SharePoint files through reusable Microsoft Graph tenant profiles.",
        "input_schema": {
            "type": "object",
            "required": ["action"],
            "properties": {
                "action": {"type": "string", "description": "Files action to execute"},
                "profile": {"type": "string", "description": "Graph profile name"},
                "configFile": {"type": "string", "description": "Optional Graph profile file override"},
                "user": {"type": "string", "description": "Local auth session key"},
                "graphUserId": {"type": "string", "description": "Graph user id override"},
                "top": {"type": "integer", "description": "Max items"},
                "query": {"type": "string", "description": "Search term"},
                "id": {"type": "string", "description": "Drive item id"},
                "maxChars": {"type": "integer", "description": "Max extracted chars"},
                "driveMode": {"type": "string", "description": "me or site"},
                "siteHostname": {"type": "string", "description": "SharePoint hostname"},
                "sitePath": {"type": "string", "description": "SharePoint site path"},
                "tenantIdOverride": {"type": "string", "description": "Tenant override"},
                "clientIdOverride": {"type": "string", "description": "Client id override"},
            },
        },
        "catalog_name": "graph-files",
        "version": "0.1.0",
        "owner": "equipo-agentec",
        "implemented": True,
    }
}


def load_tool_registry() -> list[ToolDefinition]:
    approved_tools = load_approved_tools()

    tools: list[ToolDefinition] = []
    for tool in approved_tools:
        catalog_name = tool.get("name", "")

        if catalog_name in MVP_TOOL_DEFINITIONS:
            tool_def = dict(MVP_TOOL_DEFINITIONS[catalog_name])
            tool_def["version"] = str(tool.get("version", tool_def["version"]))
            tool_def["owner"] = str(tool.get("owner", tool_def["owner"]))
            tools.append(tool_def)
            continue

        # Fallback: se expone tool aprobada con metadata mínima, útil para visibilidad en tools/list.
        tools.append(
            {
                "name": _to_mcp_name(catalog_name),
                "description": f"Approved tool from catalog: {catalog_name}",
                "input_schema": {"type": "object", "properties": {}},
                "catalog_name": catalog_name,
                "version": str(tool.get("version", "unknown")),
                "owner": str(tool.get("owner", "unknown")),
                "implemented": False,
            }
        )

    return tools
