#!/usr/bin/env bash
set -e

RELEASE_FILE="${1:-releases/2026-04-demo.yaml}"

echo "Instalando release: $RELEASE_FILE"
echo "Paso 1: validar archivo de release"
test -f "$RELEASE_FILE"

echo "Paso 2: mostrar contenido"
cat "$RELEASE_FILE"

echo "Paso 3: aqui se conectara la logica futura para activar tools y skills en OpenClaw"

echo "Instalacion base completada"