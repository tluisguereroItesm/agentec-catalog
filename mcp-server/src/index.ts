import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import crypto from "node:crypto";
import http from "node:http";
import { loadRegistry, ToolHandler } from "./registry";

const PORT = parseInt(process.env.MCP_PORT ?? "3000", 10);
const MCP_AUTH_TOKEN = (process.env.AGENTEC_MCP_AUTH_TOKEN ?? "").trim();
const GRAPH_TOOL_NAMES = new Set<string>([
  "graph_mail",
  "graph_files",
  "graph_files_write",
  "graph_calendar",
  "graph_teams",
  "graph_users",
  "graph_sharepoint_search",
  "graph_approvals",
  "graph_flows",
  "graph_powerbi",
]);

/** Timing-safe token comparison to prevent timing attacks */
function isAuthorizedRequest(req: http.IncomingMessage) {
  const authHeader = (req.headers.authorization ?? "").trim();
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (!token || !MCP_AUTH_TOKEN) return false;
  try {
    const a = Buffer.from(token.padEnd(MCP_AUTH_TOKEN.length));
    const b = Buffer.from(MCP_AUTH_TOKEN.padEnd(token.length));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeUserKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9._:-]/g, "_").slice(0, 120);
}

function getSessionUserKey(req: http.IncomingMessage): string {
  const headerCandidates = [
    req.headers["mcp-session-id"],
    req.headers["x-openclaw-session-id"],
    req.headers["x-session-id"],
    req.headers["x-openclaw-connection-id"],
  ];

  for (const candidate of headerCandidates) {
    const val = Array.isArray(candidate) ? candidate[0] : candidate;
    if (typeof val === "string" && val.trim()) {
      return sanitizeUserKey(val.trim());
    }
  }

  return "owner";
}

function injectGraphUserOnBody(req: http.IncomingMessage, parsedBody: unknown): unknown {
  if (Array.isArray(parsedBody)) {
    return parsedBody.map((item) => injectGraphUserOnBody(req, item));
  }

  if (!isRecord(parsedBody)) return parsedBody;

  const method = typeof parsedBody.method === "string" ? parsedBody.method : "";
  if (method !== "tools/call") return parsedBody;

  if (!isRecord(parsedBody.params)) return parsedBody;
  const params = parsedBody.params;
  const toolName = typeof params.name === "string" ? params.name : "";
  if (!GRAPH_TOOL_NAMES.has(toolName)) return parsedBody;

  const args = isRecord(params.arguments) ? params.arguments : {};
  const existingUser = typeof args.user === "string" ? args.user.trim() : "";
  if (!existingUser) {
    args.user = getSessionUserKey(req);
    params.arguments = args;
    parsedBody.params = params;
  }

  return parsedBody;
}

function createMcpServer(tools: ToolHandler[]) {
  const server = new Server(
    { name: "agentec-mcp-server", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.schema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.name === request.params.name);
    if (!tool) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    console.log(`[agentec-mcp-server] Calling tool: ${tool.name}`);
    const result = await tool.execute(request.params.arguments);

    const isError = !(result as { success?: boolean }).success;
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      isError,
    };
  });

  return server;
}

async function main() {
  console.log("[agentec-mcp-server] Starting...");

  if (!MCP_AUTH_TOKEN) {
    console.error(
      "[agentec-mcp-server] Fatal: AGENTEC_MCP_AUTH_TOKEN is required. Refusing to start without auth token."
    );
    process.exit(1);
  }

  const tools: ToolHandler[] = await loadRegistry();

  if (tools.length === 0) {
    console.warn("[agentec-mcp-server] WARNING: No tools loaded — check approved-tools.yaml");
  } else {
    console.log(
      `[agentec-mcp-server] Loaded ${tools.length} tool(s): ${tools.map((t) => t.name).join(", ")}`
    );
  }

  // Per-request server factory — SDK 1.x StreamableHTTPServerTransport in stateless mode
  // can only serve one MCP session per instance; a singleton transport returns HTTP 500 on
  // every request after the first initialize because the internal session is already consumed.
  // Creating a new Server + Transport per request is cheap (handlers are closures over `tools`).
  function createRequestHandler(): { server: Server; transport: StreamableHTTPServerTransport } {
    const server = createMcpServer(tools);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    transport.onerror = (error) => {
      console.error("[agentec-mcp-server] transport error:", error);
    };
    return { server, transport };
  }

  const httpServer = http.createServer((req, res) => {
    const url = req.url ? new URL(req.url, "http://localhost") : null;
    if (url?.pathname === "/mcp" || url?.pathname === "/mcp/") {
      const remoteIp = req.socket?.remoteAddress ?? "?";
      console.log(
        `[mcp-req] ${req.method} /mcp from=${remoteIp} ` +
        `accept=${req.headers.accept ?? "none"} ct=${req.headers["content-type"] ?? "none"} ` +
        `auth=${req.headers.authorization ? "present" : "MISSING"}`
      );
      if (!isAuthorizedRequest(req)) {
        console.log(`[mcp-req] REJECTED 401 from=${remoteIp}`);
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32001,
              message: "Unauthorized",
            },
            id: null,
          })
        );
        return;
      }

      // Hono reads rawHeaders (not headers) to build the Web Request.
      // Inject Accept if missing so the SDK's 406 check is satisfied.
      const acceptHeader =
        typeof req.headers.accept === "string" ? req.headers.accept.toLowerCase() : "";
      const hasJson = acceptHeader.includes("application/json");
      const hasEventStream = acceptHeader.includes("text/event-stream");
      if (!hasJson || !hasEventStream) {
        req.headers.accept = "application/json, text/event-stream";
        req.rawHeaders.push("Accept", "application/json, text/event-stream");
      }

      const MAX_BODY = 1 * 1024 * 1024;
      let body = "";
      let bodySize = 0;
      req.on("data", (chunk: Buffer) => {
        bodySize += chunk.length;
        if (bodySize > MAX_BODY) {
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Request body too large" }));
          req.destroy();
          return;
        }
        body += chunk.toString();
      });

      req.on("end", () => {
        if (res.writableEnded) return;

        let parsedBody: unknown;
        if (body.trim().length > 0) {
          try {
            parsedBody = JSON.parse(body);
          } catch {
            if (!res.headersSent) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  jsonrpc: "2.0",
                  error: {
                    code: -32700,
                    message: "Parse error: Invalid JSON",
                  },
                  id: null,
                })
              );
            }
            return;
          }
        }

        const patchedBody = injectGraphUserOnBody(req, parsedBody);

        const { server: mcpServer, transport } = createRequestHandler();
        mcpServer.connect(transport).then(() => {
          return transport.handleRequest(req, res, patchedBody);
        }).catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[agentec-mcp-server] /mcp request failed:", message);

          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                jsonrpc: "2.0",
                error: {
                  code: -32603,
                  message: "Internal server error",
                },
                id: null,
              })
            );
          }
        });
      });
    } else if (url?.pathname === "/health") {
      // Public liveness probe — does NOT expose tool list (information disclosure prevention)
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          server: "agentec-mcp-server",
        })
      );
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[agentec-mcp-server] Listening on http://0.0.0.0:${PORT}/mcp`);
    console.log(`[agentec-mcp-server] Health: http://0.0.0.0:${PORT}/health`);
  });
}

main().catch((err) => {
  console.error("[agentec-mcp-server] Fatal:", err);
  process.exit(1);
});
