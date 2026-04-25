import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

export async function runExternalTool(command: string, args: string[], toolName: string, input: unknown) {
  const tempFile = path.join(os.tmpdir(), `${toolName}-${Date.now()}.json`);
  fs.writeFileSync(tempFile, JSON.stringify(input, null, 2), "utf-8");

  try {
    const finalArgs = [...args, tempFile];
    const result = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve) => {
      const child = spawn(command, finalArgs, {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("close", (code) => resolve({ stdout, stderr, code }));
    });

    if (result.code !== 0) {
      throw new Error(`${toolName} failed: ${result.stderr || result.stdout}`.trim());
    }

    const trimmed = result.stdout.trim();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      const lines = trimmed.split(/\r?\n/).filter(Boolean);
      const lastLine = lines[lines.length - 1] || "{}";
      parsed = JSON.parse(lastLine) as Record<string, unknown>;
    }
    parsed.tool = parsed.tool ?? toolName;
    return parsed;
  } finally {
    fs.rmSync(tempFile, { force: true });
  }
}

export function externalToolsDir() {
  return process.env.AGENTEC_TOOLS_DIR ?? "/app/external-tools";
}
