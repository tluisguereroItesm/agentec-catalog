# ─── Stage 1: Build TypeScript ───────────────────────────────────────────────
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


# ─── Stage 3: Runtime with Playwright / Chromium ─────────────────────────────
FROM mcr.microsoft.com/playwright:v1.52.0-noble AS runtime

WORKDIR /app

# Compiled server
COPY --from=builder   /build/dist/        ./dist/
# Production node_modules (includes playwright, @modelcontextprotocol/sdk, js-yaml)
COPY --from=prod-deps /build/node_modules/ ./node_modules/

# Catalog yaml — determines which tools are active at runtime
COPY agentec-catalog/tools/ ./catalog/tools/

RUN mkdir -p ./artifacts

ENV MCP_PORT=3000
ENV CATALOG_DIR=/app/catalog

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
