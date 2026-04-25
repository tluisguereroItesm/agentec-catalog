import path from "node:path";
import { externalToolsDir, runExternalTool } from "./run-external-tool";

export const description =
  "Executes a browser-based login flow using the Python backend and reusable site profiles.";

export const schema = {
  type: "object" as const,
  required: ["username", "password"],
  properties: {
    configProfile: { type: "string", description: "Named web-login profile" },
    configFile: { type: "string", description: "Optional profile file override" },
    url: { type: "string", description: "Login page URL" },
    username: { type: "string", description: "Username" },
    password: { type: "string", description: "Password" },
    usernameSelector: { type: "string", description: "CSS selector for username field" },
    passwordSelector: { type: "string", description: "CSS selector for password field" },
    submitSelector: { type: "string", description: "CSS selector for submit button" },
    successIndicator: { type: "string", description: "Success selector" },
    headless: { type: "boolean", description: "Run headless" },
    timeoutMs: { type: "integer", description: "Timeout in milliseconds" },
  },
};

export async function execute(args: unknown): Promise<unknown> {
  const entrypoint = path.join(externalToolsDir(), "web-login-playwright-py", "src", "main.py");
  return runExternalTool("python3", [entrypoint], "web_login_playwright_py", args);
}
