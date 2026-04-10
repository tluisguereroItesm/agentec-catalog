import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

interface LoginInput {
  url: string;
  username: string;
  password: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  successIndicator?: string;
  headless?: boolean;
  timeoutMs?: number;
}

export const description =
  "Executes a browser-based login flow using Playwright and generates screenshot evidence. " +
  "Use for login monitoring, smoke tests, and authentication validation.";

export const schema = {
  type: "object" as const,
  required: [
    "url",
    "username",
    "password",
    "usernameSelector",
    "passwordSelector",
    "submitSelector",
  ],
  properties: {
    url:              { type: "string",  description: "Login page URL" },
    username:         { type: "string",  description: "Username" },
    password:         { type: "string",  description: "Password" },
    usernameSelector: { type: "string",  description: "CSS selector for username field" },
    passwordSelector: { type: "string",  description: "CSS selector for password field" },
    submitSelector:   { type: "string",  description: "CSS selector for submit button" },
    successIndicator: { type: "string",  description: "CSS selector that confirms successful login" },
    headless:         { type: "boolean", description: "Run headless (default: true)" },
    timeoutMs:        { type: "integer", description: "Timeout in ms (default: 30000)" },
  },
};

export async function execute(args: unknown): Promise<unknown> {
  const input = args as LoginInput;

  const artifactsDir = path.resolve(process.cwd(), "artifacts");
  fs.mkdirSync(artifactsDir, { recursive: true });

  const ts = Date.now();
  const screenshotPath = path.join(artifactsDir, `login-${ts}.png`);
  const resultPath     = path.join(artifactsDir, `result-${ts}.json`);

  const browser = await chromium.launch({ headless: input.headless ?? true });
  const page    = await browser.newPage();
  page.setDefaultTimeout(input.timeoutMs ?? 30000);

  let success = false;
  let message = "";

  try {
    await page.goto(input.url, { waitUntil: "domcontentloaded" });
    await page.fill(input.usernameSelector, input.username);
    await page.fill(input.passwordSelector, input.password);
    await page.click(input.submitSelector);

    if (input.successIndicator) {
      await page.waitForSelector(input.successIndicator, {
        timeout: input.timeoutMs ?? 30000,
      });
    }

    await page.screenshot({ path: screenshotPath, fullPage: true });
    success = true;
    message = "Login ejecutado correctamente";
  } catch (err) {
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    message = err instanceof Error ? err.message : "Error desconocido";
  } finally {
    await browser.close();
  }

  const result = { success, message, screenshotPath, resultPath };
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
  return result;
}
