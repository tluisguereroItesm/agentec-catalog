import path from "node:path";
import { externalToolsDir, runExternalTool } from "./run-external-tool";

export const description =
  "Consulta y descarga el comprobante CURP (PDF) desde gob.mx/curp usando Playwright. " +
  "Entrega el PDF como adjunto de correo (delivery=email), sube a OneDrive (delivery=onedrive) " +
  "o lo guarda como artefacto local (delivery=artifact, default).";

export const schema = {
  type: "object" as const,
  required: ["curp"],
  properties: {
    curp: {
      type: "string",
      description: "CURP de 18 caracteres a consultar (ej: GARC800101HDFRLB01)",
    },
    delivery: {
      type: "string",
      enum: ["artifact", "email", "onedrive"],
      description: "Forma de entrega: artifact (default), email o onedrive",
    },
    to: {
      type: "string",
      description: "Correo(s) destino separados por coma. Requerido si delivery=email",
    },
    subject: {
      type: "string",
      description: "Asunto del correo (opcional)",
    },
    body: {
      type: "string",
      description: "Cuerpo HTML del correo (opcional)",
    },
    remoteFolder: {
      type: "string",
      description: "Carpeta en OneDrive donde guardar el PDF (default: 'CURP')",
    },
    profile: {
      type: "string",
      description: "Perfil Graph a usar para email/OneDrive",
    },
    headless: {
      type: "boolean",
      description: "Ejecutar Chromium en modo headless (default: true)",
    },
    timeoutMs: {
      type: "integer",
      description: "Timeout en milisegundos (default: 60000)",
    },
  },
};

export async function execute(args: unknown): Promise<unknown> {
  const entrypoint = path.join(externalToolsDir(), "curp-downloader", "src", "main.py");
  return runExternalTool("python3", [entrypoint], "curp_downloader", args);
}
