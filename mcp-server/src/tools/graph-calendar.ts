import path from "node:path";
import { externalToolsDir, runExternalTool } from "./run-external-tool";

export const description =
  "Reads and manages the Microsoft 365 calendar — view today's events, weekly/monthly agenda, create meetings, check availability, update or cancel events.";

export const schema = {
  type: "object" as const,
  properties: {
    action: { type: "string", description: "Action: today, week, month, read, create, update, delete, availability, auth-login, auth-poll" },
    profile: { type: "string" },
    id: { type: "string", description: "Event ID (required for read, update, delete)" },
    subject: { type: "string" },
    start: { type: "string", description: "ISO 8601 datetime e.g. 2026-04-25T10:00:00" },
    end: { type: "string", description: "ISO 8601 datetime" },
    timezone: { type: "string", description: "IANA timezone, default America/Monterrey" },
    body: { type: "string" },
    location: { type: "string" },
    attendees: { type: "array", items: { type: "string" }, description: "List of email addresses" },
    isOnline: { type: "boolean", description: "Create as Teams meeting" },
    days: { type: "integer", description: "Days ahead for availability check" },
    top: { type: "integer" },
    user: { type: "string" },
    graphUserId: { type: "string" },
    tenantIdOverride: { type: "string" },
    clientIdOverride: { type: "string" },
  },
};

export async function execute(args: unknown): Promise<unknown> {
  const entrypoint = path.join(externalToolsDir(), "graph-calendar", "src", "main.py");
  return runExternalTool("python3", [entrypoint], "graph_calendar", args);
}
