import path from "node:path";
import { externalToolsDir, runExternalTool } from "./run-external-tool";

export const description =
  "Reads and extracts text from a local document file (PDF, DOCX, XLSX, TXT, MD). Returns structured content, page count, word count, and character count. Use after a file download or when a document is available in the artifacts directory.";

export const schema = {
  type: "object" as const,
  required: ["filePath"],
  properties: {
    filePath:        { type: "string",  description: "Absolute or relative path to the document file" },
    maxChars:        { type: "integer", description: "Maximum characters to extract (default: 8000)" },
    includeMetadata: { type: "boolean", description: "Include page count and word count in the response" },
  },
};

export async function execute(args: unknown): Promise<unknown> {
  const entrypoint = path.join(externalToolsDir(), "doc-reader", "src", "main.py");
  return runExternalTool("python3", [entrypoint], "doc_reader", args);
}
