FROM mcr.microsoft.com/playwright:v1.59.1-noble

WORKDIR /app

# Runtime env
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV MCP_PORT=3100
ENV CATALOG_DIR=/app/catalog

# Install app dependencies
COPY agentec-catalog/mcp-server-py/pyproject.toml ./pyproject.toml
COPY agentec-catalog/mcp-server-py/README.md ./README.md
COPY agentec-catalog/mcp-server-py/src ./src

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3-pip \
  && rm -rf /var/lib/apt/lists/* \
  && python3 -m pip install --break-system-packages --no-cache-dir .

RUN python3 -m playwright install chromium

# Catalog yaml for approved tools resolution
COPY agentec-catalog/tools ./catalog/tools

RUN mkdir -p /app/artifacts

EXPOSE 3100

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:3100/health', timeout=3)"

CMD ["uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "3100"]
