import path from "node:path";
import { externalToolsDir, runExternalTool } from "./run-external-tool";

export const description =
  "Lists and cleans up accumulated artifacts, logs, and temporary files within the Agentec stack. " +
  "Use to free disk space or remove old session data that may contain sensitive information. " +
  "Always use dry_run=true first to see what would be deleted before committing.";

export const schema = {
  type: "object" as const,
  required: ["action"],
  properties: {
    action: {
      type: "string",
      description:
        "Cleanup action: 'status' (disk usage report), 'artifacts' (clean tool result JSONs/PNGs), " +
        "'logs' (clean log files), 'purge' (delete specific files by name)",
    },
    dry_run: {
      type: "boolean",
      description: "If true, only shows what would be deleted without deleting anything. Default: true.",
    },
    older_than_days: {
      type: "integer",
      description:
        "Only delete files older than this many days. Default: 7 for artifacts, 30 for logs.",
    },
    pattern: {
      type: "string",
      description:
        "Glob pattern to filter files within the target directory (e.g. '*.png', 'graph-mail-*'). " +
        "Only filename patterns allowed — no paths or '..' allowed.",
    },
    filenames: {
      type: "array",
      items: { type: "string" },
      description:
        "For 'purge' action only: exact filenames (no paths) to delete from target_dir.",
    },
    target_dir: {
      type: "string",
      description:
        "For 'purge' action only: target directory. One of: 'artifacts', 'logs', 'tokens'. Default: 'artifacts'.",
    },
  },
};

export async function execute(args: unknown): Promise<unknown> {
  const entrypoint = path.join(externalToolsDir(), "cleanup", "src", "main.py");
  return runExternalTool("python3", [entrypoint], "cleanup", args);
}
