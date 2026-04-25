# ─── Stage 1: Build MCP Server TypeScript ────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /build

COPY agentec-catalog/mcp-server/package*.json ./
RUN npm ci

COPY agentec-catalog/mcp-server/tsconfig.json ./
COPY agentec-catalog/mcp-server/src/ ./src/

RUN npx tsc


# ─── Stage 2: Production deps only (no devDeps) ──────────────────────────────
FROM node:22-slim AS prod-deps

WORKDIR /build

COPY agentec-catalog/mcp-server/package*.json ./
RUN npm ci --omit=dev


# ─── Stage 3: Build web-fetch-download tool ──────────────────────────────────
FROM node:22-slim AS tool-web-fetch-download

WORKDIR /build

COPY agentec-tools/tools/web-fetch-download/package*.json ./
RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --ignore-scripts

COPY agentec-tools/tools/web-fetch-download/tsconfig.json ./
COPY agentec-tools/tools/web-fetch-download/src/ ./src/

RUN npx tsc


# ─── Stage 4: Runtime with Playwright / Chromium ─────────────────────────────
FROM mcr.microsoft.com/playwright:v1.58.0-noble AS runtime

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip \
  && rm -rf /var/lib/apt/lists/* \
  && python3 -m pip install --break-system-packages --no-cache-dir \
       playwright pypdf pdfplumber python-docx openpyxl

# Compiled MCP server
COPY --from=builder   /build/dist/        ./dist/
# Production node_modules (includes playwright, @modelcontextprotocol/sdk, js-yaml)
COPY --from=prod-deps /build/node_modules/ ./node_modules/

# web-fetch-download tool baked in (not dependent on volume mount)
COPY --from=tool-web-fetch-download /build/dist/ ./tools-builtin/web-fetch-download/dist/
COPY --from=tool-web-fetch-download /build/node_modules/ ./tools-builtin/web-fetch-download/node_modules/

# Catalog yaml — determines which tools are active at runtime
COPY agentec-catalog/tools/ ./catalog/tools/

RUN mkdir -p ./artifacts ./graph-tokens \
  && chown -R pwuser:pwuser /app

ENV MCP_PORT=3000
ENV CATALOG_DIR=/app/catalog

USER pwuser

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
