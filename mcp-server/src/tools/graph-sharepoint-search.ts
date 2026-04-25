import path from "node:path";
import { externalToolsDir, runExternalTool } from "./run-external-tool";

export const description =
  "Searches for documents, files, and content across all SharePoint sites and OneDrive in the organization using Microsoft Search API.";

export const schema = {
  type: "object" as const,
  properties: {
    action: { type: "string", description: "Action: search, list-sites, auth-login, auth-poll" },
    profile: { type: "string", description: "Graph profile name" },
    query: { type: "string", description: "Search query text" },
    top: { type: "integer", description: "Max results (default 20)" },
    contentSources: {
      type: "array",
      items: { type: "string" },
      description: "Optional list of SharePoint site IDs to scope the search",
    },
    user: { type: "string", description: "Local auth session key" },
    tenantIdOverride: { type: "string", description: "Tenant override" },
    clientIdOverride: { type: "string", description: "Client id override" },
  },
};

export async function execute(args: unknown): Promise<unknown> {
  const entrypoint = path.join(externalToolsDir(), "graph-sharepoint-search", "src", "main.py");
  return runExternalTool("python3", [entrypoint], "graph_sharepoint_search", args);
}
