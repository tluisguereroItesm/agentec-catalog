import path from "node:path";
import { externalToolsDir, runExternalTool } from "./run-external-tool";

export const description =
  "Searches for users, looks up the organizational directory, and navigates reporting hierarchies in Microsoft 365 via Microsoft Graph.";

export const schema = {
  type: "object" as const,
  properties: {
    action: { type: "string", description: "Action: search, list, me, manager, reports, auth-login, auth-poll" },
    profile: { type: "string", description: "Graph profile name" },
    query: { type: "string", description: "Person name or email to search" },
    department: { type: "string", description: "Department filter for list action" },
    top: { type: "integer", description: "Max results (default 20)" },
    user: { type: "string", description: "Local auth session key" },
    tenantIdOverride: { type: "string", description: "Tenant override" },
    clientIdOverride: { type: "string", description: "Client id override" },
  },
};

export async function execute(args: unknown): Promise<unknown> {
  const entrypoint = path.join(externalToolsDir(), "graph-users", "src", "main.py");
  return runExternalTool("python3", [entrypoint], "graph_users", args);
}
