import path from "node:path";
import { externalToolsDir, runExternalTool } from "./run-external-tool";

export const description =
  "Accesses Power BI workspaces, reports, dashboards, and datasets. Can list and search content, execute real DAX queries against datasets (no hallucination), open reports in browser, inspect report pages, dashboard tiles, dataset schema, and manage dataset refreshes.";

export const schema = {
  type: "object" as const,
  properties: {
    action: {
      type: "string",
      description:
        "Action: workspaces, reports, dashboards, datasets, query (DAX), open, pages, tiles, schema, refresh, auth-login, auth-poll",
    },
    profile: { type: "string" },
    workspaceId: { type: "string", description: "Power BI workspace (group) ID" },
    reportId: { type: "string", description: "Report ID (for open, pages)" },
    dashboardId: { type: "string", description: "Dashboard ID (for tiles)" },
    datasetId: { type: "string", description: "Dataset ID (for query, schema, refresh)" },
    dax: {
      type: "string",
      description:
        "DAX query string for action=query. Example: EVALUATE SUMMARIZE(Sales, Sales[Year], \"Total\", SUM(Sales[Amount]))",
    },
    search: { type: "string", description: "Search/filter text for reports, dashboards or workspaces" },
    query: { type: "string", description: "Alias for search" },
    trigger: { type: "boolean", description: "Set true to trigger a dataset refresh (action=refresh)" },
    top: { type: "integer", description: "Max results (default 50)" },
    user: { type: "string" },
    tenantIdOverride: { type: "string" },
    clientIdOverride: { type: "string" },
  },
};

export async function execute(args: unknown): Promise<unknown> {
  const entrypoint = path.join(externalToolsDir(), "graph-powerbi", "src", "main.py");
  return runExternalTool("python3", [entrypoint], "graph_powerbi", args);
}
