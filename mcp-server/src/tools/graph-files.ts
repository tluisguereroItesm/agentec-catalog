import path from "node:path";
import { externalToolsDir, runExternalTool } from "./run-external-tool";

export const description =
  "Reads and summarizes OneDrive or SharePoint files through reusable Microsoft Graph tenant profiles.";

export const schema = {
  type: "object" as const,
  required: ["action"],
  properties: {
    action: { type: "string", description: "Files action to execute" },
    profile: { type: "string", description: "Graph profile name" },
    configFile: { type: "string", description: "Optional Graph profile file override" },
    user: { type: "string", description: "Local auth session key" },
    graphUserId: { type: "string", description: "Graph user id override" },
    top: { type: "integer", description: "Max items" },
    query: { type: "string", description: "Search query" },
    id: { type: "string", description: "Drive item id" },
    maxChars: { type: "integer", description: "Max extracted chars" },
    driveMode: { type: "string", description: "me or site" },
    siteHostname: { type: "string", description: "SharePoint hostname" },
    sitePath: { type: "string", description: "SharePoint path" },
    tenantIdOverride: { type: "string", description: "Tenant override" },
    clientIdOverride: { type: "string", description: "Client id override" },
  },
};

export async function execute(args: unknown): Promise<unknown> {
  const entrypoint = path.join(externalToolsDir(), "graph-files", "src", "main.py");
  return runExternalTool("python3", [entrypoint], "graph_files", args);
}
