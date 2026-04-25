import path from "node:path";
import { externalToolsDir, runExternalTool } from "./run-external-tool";

export const description =
  "Retrieves and manages Power Automate approval requests — pending approvals, history, and urgency summaries — via Microsoft Graph.";

export const schema = {
  type: "object" as const,
  properties: {
    action: { type: "string", description: "Action: pending, all, history, auth-login, auth-poll" },
    profile: { type: "string", description: "Graph profile name" },
    top: { type: "integer", description: "Max results (default 20)" },
    user: { type: "string", description: "Local auth session key" },
    tenantIdOverride: { type: "string", description: "Tenant override" },
    clientIdOverride: { type: "string", description: "Client id override" },
  },
};

export async function execute(args: unknown): Promise<unknown> {
  const entrypoint = path.join(externalToolsDir(), "graph-approvals", "src", "main.py");
  return runExternalTool("python3", [entrypoint], "graph_approvals", args);
}
