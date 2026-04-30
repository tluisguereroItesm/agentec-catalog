import path from "node:path";
import fs from "node:fs";
import { externalToolsDir, runExternalTool } from "./run-external-tool";

export const description =
  "Navega con Playwright y permite ejecutar flujos multistep (login/navegación/interacciones) para descargar documentos. También puede extraer ID y formato de YouTube (sin descargar video protegido).";

export const schema = {
  type: "object" as const,
  required: ["url"],
  properties: {
    action: {
      type: "string",
      enum: ["download-document", "extract-youtube-id"],
      description: "Acción a ejecutar. Por defecto: download-document",
    },
    url:              { type: "string",  description: "URL of the page or direct download link" },
    configProfile:    { type: "string",  description: "Login profile name from profiles.json (if auth is needed)" },
    configFile:       { type: "string",  description: "Path to custom profiles file" },
    username:         { type: "string",  description: "Username for login (overrides profile)" },
    password:         { type: "string",  description: "Password for login (overrides profile)" },
    downloadSelector: { type: "string",  description: "CSS selector of the element to click to trigger download" },
    waitForDownload:  { type: "boolean", description: "Wait for a browser download event (default: true)" },
    steps: {
      type: "array",
      description: "Pasos secuenciales para flujos complejos. Cada paso soporta: goto, fill, click, waitForSelector, waitForTimeout, downloadClick, extractAttribute, extractText",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: [
              "goto",
              "fill",
              "click",
              "waitForSelector",
              "waitForTimeout",
              "downloadClick",
              "extractAttribute",
              "extractText",
            ],
          },
          url: { type: "string" },
          selector: { type: "string" },
          value: { type: "string" },
          attribute: { type: "string" },
          key: { type: "string" },
          timeoutMs: { type: "integer" },
        },
      },
    },
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
