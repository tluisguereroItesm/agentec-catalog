import path from "node:path";
import { externalToolsDir, runExternalTool } from "./run-external-tool";

export const description =
  "Lists, reads, triggers, enables, disables, and inspects run history of Power Automate flows via the Power Platform API.";

export const schema = {
  type: "object" as const,
  properties: {
    action: { type: "string", description: "Action: list, read, runs, trigger, enable, disable, auth-login, auth-poll" },
    profile: { type: "string" },
    flowId: { type: "string", description: "Flow name/ID (required for read, runs, trigger, enable, disable)" },
    environment: { type: "string", description: "Power Platform environment (default: ~default)" },
    triggerBody: { type: "object", description: "JSON body to pass to a manual trigger" },
    top: { type: "integer" },
    user: { type: "string" },
    tenantIdOverride: { type: "string" },
    clientIdOverride: { type: "string" },
  },
};

export async function execute(args: unknown): Promise<unknown> {
  const entrypoint = path.join(externalToolsDir(), "graph-flows", "src", "main.py");
  return runExternalTool("python3", [entrypoint], "graph_flows", args);
}
