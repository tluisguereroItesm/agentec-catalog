import path from "node:path";
import { externalToolsDir, runExternalTool } from "./run-external-tool";

export const description =
  "Reads and analyzes Microsoft 365 email through reusable Microsoft Graph tenant profiles.";

export const schema = {
  type: "object" as const,
  required: ["action"],
  properties: {
    action: { type: "string", description: "Mail action to execute" },
    profile: { type: "string", description: "Graph profile name" },
    configFile: { type: "string", description: "Optional Graph profile file override" },
    user: { type: "string", description: "Local auth session key" },
    graphUserId: { type: "string", description: "Graph user id override" },
    top: { type: "integer", description: "Max items" },
    sender: { type: "string", description: "Sender filter" },
    query: { type: "string", description: "Search query" },
    id: { type: "string", description: "Message or conversation id" },
    project: { type: "string", description: "Project name" },
    days: { type: "integer", description: "Days back" },
    period: { type: "string", description: "Digest period" },
    tenantIdOverride: { type: "string", description: "Tenant override" },
    clientIdOverride: { type: "string", description: "Client id override" },
  },
};

export async function execute(args: unknown): Promise<unknown> {
  const entrypoint = path.join(externalToolsDir(), "graph-mail", "src", "main.py");
  return runExternalTool("python3", [entrypoint], "graph_mail", args);
}
