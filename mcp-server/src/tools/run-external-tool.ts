import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

type ExternalResult = Record<string, unknown>;

const GRAPH_TOOL_NAMES = new Set<string>([
  "graph_mail",
  "graph_files",
  "graph_files_write",
  "graph_calendar",
  "graph_teams",
  "graph_users",
  "graph_sharepoint_search",
  "graph_approvals",
  "graph_flows",
  "graph_powerbi",
  // curp_downloader handles Graph auth internally (only when delivery=email/onedrive).
  // It must NOT be in this set — forcing auth on every call breaks delivery=artifact.
]);

const AUTH_ACTIONS = new Set<string>(["auth-login", "auth-poll"]);

const graphAuthState = new Map<string, { status: "pending" | "ok"; updatedAt: number }>();

function isGraphTool(toolName: string) {
  return GRAPH_TOOL_NAMES.has(toolName);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getGraphAction(input: unknown): string | undefined {
  if (!isRecord(input)) return undefined;
  return getString(input.action);
}

function getGraphSessionKey(toolName: string, input: unknown): string {
  const profile = isRecord(input)
    ? getString(input.profile) ?? getString(process.env.AGENTEC_GRAPH_PROFILE) ?? "default"
    : getString(process.env.AGENTEC_GRAPH_PROFILE) ?? "default";
  const user = isRecord(input) ? getString(input.user) ?? "default" : "default";
  return `${toolName}::${profile}::${user}`;
}

function isAuthErrorResult(result: ExternalResult): boolean {
  const success = result.success;
  const errorType = getString(result.errorType)?.toUpperCase();
  const message = getString(result.message)?.toLowerCase() ?? "";
  if (success === true) return false;
  if (errorType?.includes("AUTH")) return true;
  return message.includes("auth") || message.includes("token") || message.includes("unauthorized");
}

function getLoginInput(input: unknown): Record<string, unknown> {
  const src = isRecord(input) ? input : {};
  return {
    action: "auth-login",
    profile: src.profile,
    user: src.user,
    tenantIdOverride: src.tenantIdOverride,
    clientIdOverride: src.clientIdOverride,
    configFile: src.configFile,
  };
}

function getPollInput(input: unknown): Record<string, unknown> {
  const src = isRecord(input) ? input : {};
  return {
    action: "auth-poll",
    profile: src.profile,
    user: src.user,
    tenantIdOverride: src.tenantIdOverride,
    clientIdOverride: src.clientIdOverride,
    configFile: src.configFile,
  };
}

async function runExternalToolRaw(
  command: string,
  args: string[],
  toolName: string,
  input: unknown
): Promise<ExternalResult> {
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
    let parsed: ExternalResult;
    try {
      parsed = JSON.parse(trimmed) as ExternalResult;
    } catch {
      const lines = trimmed.split(/\r?\n/).filter(Boolean);
      const lastLine = lines[lines.length - 1] || "{}";
      parsed = JSON.parse(lastLine) as ExternalResult;
    }
    parsed.tool = parsed.tool ?? toolName;
    return parsed;
  } finally {
    fs.rmSync(tempFile, { force: true });
  }
}

export async function runExternalTool(command: string, args: string[], toolName: string, input: unknown) {
  const enforceGraphAuth = (process.env.AGENTEC_GRAPH_AUTH_ENFORCE ?? "1") !== "0";
  const graphAction = getGraphAction(input);

  if (!enforceGraphAuth || !isGraphTool(toolName)) {
    return runExternalToolRaw(command, args, toolName, input);
  }

  const sessionKey = getGraphSessionKey(toolName, input);
  let state = graphAuthState.get(sessionKey);

  // Si ya hay login pendiente y llega una acción de negocio, intenta auth-poll automáticamente.
  if (state?.status === "pending" && (!graphAction || !AUTH_ACTIONS.has(graphAction))) {
    const pollResult = await runExternalToolRaw(command, args, toolName, getPollInput(input));
    const pollStatus = isRecord(pollResult.data) ? getString(pollResult.data.status) : undefined;

    if ((pollResult.success as boolean | undefined) === true && pollStatus === "ok") {
      graphAuthState.set(sessionKey, { status: "ok", updatedAt: Date.now() });
      state = graphAuthState.get(sessionKey);
    } else if (pollStatus === "pending") {
      graphAuthState.set(sessionKey, { status: "pending", updatedAt: Date.now() });
      state = graphAuthState.get(sessionKey);
      return {
        success: true,
        requiresAuth: true,
        errorType: "AUTH_PENDING",
        message: `Tu autenticación para ${toolName} aún está pendiente. Completa el login en Microsoft Device y vuelve a intentar.`,
        originalAction: graphAction ?? "unknown",
        data: {
          status: "pending",
          next: "retry-original-action",
        },
        tool: toolName,
      };
    }
  }

  // Acciones de autenticación pasan directo para no romper el flujo explícito del usuario.
  if (graphAction && AUTH_ACTIONS.has(graphAction)) {
    const authResult = await runExternalToolRaw(command, args, toolName, input);
    const status = isRecord(authResult.data) ? getString(authResult.data.status) : undefined;
    if (graphAction === "auth-login") {
      graphAuthState.set(sessionKey, { status: "pending", updatedAt: Date.now() });
    } else if (graphAction === "auth-poll") {
      if ((authResult.success as boolean | undefined) === true && status === "ok") {
        graphAuthState.set(sessionKey, { status: "ok", updatedAt: Date.now() });
      } else if (status === "pending") {
        graphAuthState.set(sessionKey, { status: "pending", updatedAt: Date.now() });
      }
    }
    return authResult;
  }

  // Enforcement obligatorio: si no hay estado autenticado, iniciar auth-login automáticamente.
  if (!state || state.status !== "ok") {
    const loginResult = await runExternalToolRaw(command, args, toolName, getLoginInput(input));
    graphAuthState.set(sessionKey, { status: "pending", updatedAt: Date.now() });

    const loginData = isRecord(loginResult.data) ? loginResult.data : {};
    const verificationUri = getString(loginData.verification_uri) ?? "https://login.microsoft.com/device";
    const userCode = getString(loginData.user_code) ?? "(sin código)";

    return {
      success: true,
      requiresAuth: true,
      errorType: "AUTH_REQUIRED",
      message: `Autenticación obligatoria para ${toolName}. Antes de continuar, abre ${verificationUri} e ingresa el código ${userCode}. Después responde \"listo\" para ejecutar auth-poll.`,
      originalAction: graphAction ?? "unknown",
      data: {
        status: "pending",
        verification_uri: verificationUri,
        user_code: userCode,
        next: "auth-poll",
        instructions: [
          "Abre la URL de verificación",
          "Ingresa el código mostrado",
          "Confirma con 'listo' para continuar",
        ],
      },
      tool: toolName,
    };
  }

  const businessResult = await runExternalToolRaw(command, args, toolName, input);

  // Si el backend reporta auth vencida, reinicia login en caliente y guía al usuario.
  if (isAuthErrorResult(businessResult)) {
    const loginResult = await runExternalToolRaw(command, args, toolName, getLoginInput(input));
    graphAuthState.set(sessionKey, { status: "pending", updatedAt: Date.now() });
    const loginData = isRecord(loginResult.data) ? loginResult.data : {};
    const verificationUri = getString(loginData.verification_uri) ?? "https://login.microsoft.com/device";
    const userCode = getString(loginData.user_code) ?? "(sin código)";
    return {
      success: true,
      requiresAuth: true,
      errorType: "AUTH_REQUIRED",
      message: `La sesión de ${toolName} requiere reautenticación. Abre ${verificationUri} e ingresa el código ${userCode}. Luego responde \"listo\" para continuar.`,
      originalAction: graphAction ?? "unknown",
      data: {
        status: "pending",
        verification_uri: verificationUri,
        user_code: userCode,
        next: "auth-poll",
      },
      tool: toolName,
    };
  }

  return businessResult;
}

export function externalToolsDir() {
  return process.env.AGENTEC_TOOLS_DIR ?? "/app/external-tools";
}
