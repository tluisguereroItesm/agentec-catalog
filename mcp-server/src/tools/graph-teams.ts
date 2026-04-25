import path from "node:path";
import { externalToolsDir, runExternalTool } from "./run-external-tool";

export const description =
  "Access Microsoft Teams — list joined teams, browse channels, read messages, send messages to channels, and view chats and members.";

export const schema = {
  type: "object" as const,
  properties: {
    action: { type: "string", description: "Action: teams, channels, messages, send_message, chats, members, auth-login, auth-poll" },
    profile: { type: "string" },
    teamId: { type: "string", description: "Team ID (required for channels, messages, send_message, members)" },
    channelId: { type: "string", description: "Channel ID (required for messages and send_message)" },
    body: { type: "string", description: "Message text (for send_message)" },
    top: { type: "integer" },
    user: { type: "string" },
    tenantIdOverride: { type: "string" },
    clientIdOverride: { type: "string" },
  },
};

export async function execute(args: unknown): Promise<unknown> {
  const entrypoint = path.join(externalToolsDir(), "graph-teams", "src", "main.py");
  return runExternalTool("python3", [entrypoint], "graph_teams", args);
}
