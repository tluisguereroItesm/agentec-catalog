import path from "node:path";
import { externalToolsDir, runExternalTool } from "./run-external-tool";

export const description =
  "Consulta y descarga el comprobante CURP (PDF) desde gob.mx/curp usando Playwright. " +
  "Soporta búsqueda por clave CURP (searchMode=curp) o por datos personales (searchMode=datos). " +
  "Entrega el PDF como adjunto de correo (delivery=email), sube a OneDrive (delivery=onedrive) " +
  "o lo guarda como artefacto local (delivery=artifact, default).";

export const schema = {
  type: "object" as const,
  properties: {
    searchMode: {
      type: "string",
      enum: ["curp", "datos"],
      description:
        "Modo de búsqueda: 'curp' (default) para buscar por clave CURP, " +
        "'datos' para buscar por datos personales (nombre, apellidos, fecha nacimiento, sexo, estado)",
    },
    // ── searchMode=curp ──────────────────────────────────────────────────────
    curp: {
      type: "string",
      description: "CURP de 18 caracteres. Requerido si searchMode=curp (ej: GARC800101HDFRLB01)",
    },
    // ── searchMode=datos ─────────────────────────────────────────────────────
    nombre: {
      type: "string",
      description: "Nombre(s) de la persona (sin apellidos). Requerido si searchMode=datos",
    },
    primerApellido: {
      type: "string",
      description: "Primer apellido (paterno). Requerido si searchMode=datos",
    },
    segundoApellido: {
      type: "string",
      description: "Segundo apellido (materno). Opcional.",
    },
    diaNacimiento: {
      type: "string",
      description: "Día de nacimiento con cero inicial: '01'..'31'. Requerido si searchMode=datos",
    },
    mesNacimiento: {
      type: "string",
      description: "Mes de nacimiento con cero inicial: '01'..'12'. Requerido si searchMode=datos",
    },
    anioNacimiento: {
      type: "string",
      description: "Año de nacimiento de 4 dígitos (ej: 1990). Requerido si searchMode=datos",
    },
    sexo: {
      type: "string",
      enum: ["H", "M", "X"],
      description: "Sexo registrado: H=Hombre, M=Mujer, X=No binario. Requerido si searchMode=datos",
    },
    claveEntidad: {
      type: "string",
      description:
        "Entidad federativa de nacimiento. Acepta nombre completo ('Jalisco') o clave de 2 letras ('JC'). " +
        "Requerido si searchMode=datos.",
    },
    // ── Delivery ─────────────────────────────────────────────────────────────
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
      description: "Timeout en milisegundos (default: 90000). Aumentar a 120000+ si hay lentitud en el sitio.",
    },
  },
};

export async function execute(args: unknown): Promise<unknown> {
  const entrypoint = path.join(externalToolsDir(), "curp-downloader", "src", "main.py");
  return runExternalTool("python3", [entrypoint], "curp_downloader", args);
}
