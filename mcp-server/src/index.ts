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

  // Singleton MCP server — created once, not per request (prevents DoS via object allocation)
  const mcpServer = createMcpServer(tools);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await mcpServer.connect(transport);

  const httpServer = http.createServer((req, res) => {
    const url = req.url ? new URL(req.url, "http://localhost") : null;
    if (url?.pathname === "/mcp" || url?.pathname === "/mcp/") {
      if (!isAuthorizedRequest(req)) {
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

      // Enforce request body size limit (1 MB) to prevent memory exhaustion
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
      req.on("end", async () => {
        if (res.writableEnded) return;
        try {
          const parsedBody = body ? JSON.parse(body) : undefined;
          await transport.handleRequest(req, res, parsedBody);
        } catch (err) {
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
        }
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
