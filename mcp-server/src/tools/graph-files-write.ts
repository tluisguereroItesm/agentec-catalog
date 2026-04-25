import path from "node:path";
import { externalToolsDir, runExternalTool } from "./run-external-tool";

export const description =
  "Creates, uploads, moves, renames, copies, deletes, and shares files and folders in OneDrive and SharePoint via Microsoft Graph write operations.";

export const schema = {
  type: "object" as const,
  properties: {
    action: { type: "string", description: "Action: upload, create_folder, rename, move, copy, delete, share, auth-login, auth-poll" },
    profile: { type: "string" },
    id: { type: "string", description: "Item ID for rename/move/copy/delete/share" },
    localPath: { type: "string", description: "Absolute path to local file (for upload)" },
    remotePath: { type: "string", description: "Destination path in OneDrive e.g. Documents/report.pdf" },
    name: { type: "string", description: "New name (for rename or create_folder)" },
    parent: { type: "string", description: "Parent folder path for create_folder (default: root)" },
    destinationId: { type: "string", description: "Destination folder ID for move/copy" },
    linkType: { type: "string", description: "view | edit (for share, default: view)" },
    scope: { type: "string", description: "organization | anonymous (for share, default: organization)" },
    user: { type: "string" },
    graphUserId: { type: "string" },
    tenantIdOverride: { type: "string" },
    clientIdOverride: { type: "string" },
  },
};

export async function execute(args: unknown): Promise<unknown> {
  const entrypoint = path.join(externalToolsDir(), "graph-files-write", "src", "main.py");
  return runExternalTool("python3", [entrypoint], "graph_files_write", args);
}
