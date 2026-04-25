import path from "node:path";
import fs from "node:fs";
import { externalToolsDir, runExternalTool } from "./run-external-tool";

export const description =
  "Navigates to a URL with Playwright and downloads the target document. Optionally executes a login step first using a configured web-login profile. Returns the local file path and a screenshot as evidence.";

export const schema = {
  type: "object" as const,
  required: ["url"],
  properties: {
    url:              { type: "string",  description: "URL of the page or direct download link" },
    configProfile:    { type: "string",  description: "Login profile name from profiles.json (if auth is needed)" },
    configFile:       { type: "string",  description: "Path to custom profiles file" },
    username:         { type: "string",  description: "Username for login (overrides profile)" },
    password:         { type: "string",  description: "Password for login (overrides profile)" },
    downloadSelector: { type: "string",  description: "CSS selector of the element to click to trigger download" },
    waitForDownload:  { type: "boolean", description: "Wait for a browser download event (default: true)" },
    headless:         { type: "boolean", description: "Run browser headless (default: true)" },
    timeoutMs:        { type: "integer", description: "Timeout in milliseconds (default: 30000)" },
  },
};

function resolveEntrypoint(): string {
  // 1. Volume-mounted (host compiled) — preferred when available
  const external = path.join(externalToolsDir(), "web-fetch-download", "dist", "index.js");
  if (fs.existsSync(external)) return external;
  // 2. Baked-in during image build (always present in the container)
  return path.join("/app/tools-builtin", "web-fetch-download", "dist", "index.js");
}

export async function execute(args: unknown): Promise<unknown> {
  return runExternalTool("node", [resolveEntrypoint()], "web_fetch_download", args);
}
