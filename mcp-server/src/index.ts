import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import http from "node:http";
import { loadRegistry, ToolHandler } from "./registry";

const PORT = parseInt(process.env.MCP_PORT ?? "3000", 10);

async function main() {
  console.log("[agentec-mcp-server] Starting...");

  const tools: ToolHandler[] = await loadRegistry();

  if (tools.length === 0) {
    console.warn("[agentec-mcp-server] WARNING: No tools loaded — check approved-tools.yaml");
  } else {
    console.log(
      `[agentec-mcp-server] Loaded ${tools.length} tool(s): ${tools.map((t) => t.name).join(", ")}`
    );
  }

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

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);

  const httpServer = http.createServer((req, res) => {
    if (req.url === "/mcp" || req.url === "/mcp/") {
      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        transport.handleRequest(req, res, body ? JSON.parse(body) : undefined);
      });
    } else if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          server: "agentec-mcp-server",
          tools: tools.map((t) => t.name),
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
