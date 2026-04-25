import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

export interface ToolHandler {
  name: string;
  description: string;
  schema: object;
  execute: (args: unknown) => Promise<unknown>;
}

interface ApprovedTool {
  name: string;
  version: string;
  status: string;
}

interface ApprovedToolsYaml {
  approved_tools: ApprovedTool[];
}

// Maps catalog tool name (kebab) to the handler module path (relative to this file at runtime)
const HANDLER_MAP: Record<string, string> = {
  "web-login-playwright": "./tools/web-login-playwright",
  "web-login-playwright-py": "./tools/web-login-playwright-py",
  "graph-mail": "./tools/graph-mail",
  "graph-files": "./tools/graph-files",
  "web-fetch-download": "./tools/web-fetch-download",
  "doc-reader": "./tools/doc-reader",
  "graph-users": "./tools/graph-users",
  "graph-sharepoint-search": "./tools/graph-sharepoint-search",
  "graph-approvals": "./tools/graph-approvals",
  "graph-calendar": "./tools/graph-calendar",
  "graph-files-write": "./tools/graph-files-write",
  "graph-teams": "./tools/graph-teams",
  "graph-flows": "./tools/graph-flows",
  "graph-powerbi": "./tools/graph-powerbi",
  "cleanup": "./tools/cleanup",
};

// Converts kebab-case catalog name to MCP snake_case tool name
function toMcpName(name: string): string {
  return name.replace(/-/g, "_");
}

export async function loadRegistry(): Promise<ToolHandler[]> {
  // CATALOG_DIR env var lets CI/CD or Docker override the path.
  // Default: one level above dist/ → /app/catalog
  const catalogDir =
    process.env.CATALOG_DIR ??
    path.resolve(__dirname, "..", "catalog");

  const yamlPath = path.join(catalogDir, "tools", "approved-tools.yaml");

  if (!fs.existsSync(yamlPath)) {
    throw new Error(`approved-tools.yaml not found at: ${yamlPath}`);
  }

  const data = yaml.load(fs.readFileSync(yamlPath, "utf-8")) as ApprovedToolsYaml;
  const handlers: ToolHandler[] = [];

  for (const tool of data.approved_tools) {
    if (tool.status !== "approved") {
      console.log(`[registry] Skipping ${tool.name} (status: ${tool.status})`);
      continue;
    }

    const handlerPath = HANDLER_MAP[tool.name];
    if (!handlerPath) {
      console.warn(`[registry] No handler for tool "${tool.name}" — add one to HANDLER_MAP`);
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(handlerPath) as {
      description: string;
      schema: object;
      execute: (args: unknown) => Promise<unknown>;
    };

    handlers.push({
      name: toMcpName(tool.name),
      description: mod.description,
      schema: mod.schema,
      execute: mod.execute,
    });

    console.log(`[registry] ✓ ${toMcpName(tool.name)} v${tool.version}`);
  }

  return handlers;
}
