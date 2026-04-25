# agentec-mcp-server-py

MVP del servidor MCP en Python para AgenTEC.

## Implementado (Paso 5)
- `GET /health`
- `POST /mcp` con métodos:
  - `tools/list`
  - `tools/call` (inicial para `web_login_playwright`)

## Variables de entorno
- `MCP_PORT` (default: `3100`)
- `AGENTEC_MCP_AUTH_TOKEN` (opcional; si se define, exige `Authorization`)
- `CATALOG_DIR` (opcional; default: raíz de `agentec-catalog`)
- `AGENTEC_MCP_TIMEOUT_SECONDS` (default: `20`) timeout por defecto para `tools/call`
- `AGENTEC_MCP_MAX_TIMEOUT_SECONDS` (default: `120`) límite superior permitido por request
- `AGENTEC_MCP_LOG_LEVEL` (default: `INFO`) nivel de logging estructurado JSON
- `AGENTEC_TOOLS_DIR` (default runtime: `/app/external-tools`) ruta de tools montadas
- `AGENTEC_WEB_LOGIN_BACKEND` (`auto|python|node`) estrategia de backend para `web_login_playwright`
- `AGENTEC_WEB_LOGIN_PY_ENTRYPOINT` entrypoint Python de `web-login-playwright-py`
- `AGENTEC_WEB_LOGIN_NODE_ENTRYPOINT` wrapper legacy Node de compatibilidad

## Ejecutar local
1. Instalar dependencias del proyecto.
2. Iniciar:
   - `uvicorn src.app:app --host 0.0.0.0 --port 3100`

## Notas
- Este MVP responde JSON-RPC 2.0 en formato `application/json`.
- `text/event-stream` queda para fase posterior.
- Responde `X-Request-Id` para correlación de logs/errores.

## Logging estructurado
Se emiten eventos JSON con `request_id` a lo largo de todo el pipeline MCP:
- `mcp.request.received`
- `mcp.protocol.dispatch`
- `mcp.tools.list`
- `mcp.tools.call.start|success|error`
- `mcp.executor.start|finish|timeout`
- `mcp.request.completed`

## Compatibilidad temporal (Paso 10)
Para `web_login_playwright`, el ejecutor usa:
- `python` (migrado) como backend principal.
- `node` wrapper legacy como fallback en modo `auto`.

Esto permite transición gradual sin romper consumidores legacy.

## Errores estructurados (JSON-RPC)
- `-32600`: Invalid Request
- `-32601`: Method not found / tool desconocida
- `-32602`: Invalid params
- `-32700`: Parse error
- `-32002`: Tool execution timeout
- `-32004`: Tool not implemented
- `-32010`: Tool execution error
