#!/usr/bin/env bash
set -e

RELEASE_FILE="${1:-releases/2026-04-demo.yaml}"

echo "Actualizando a release: $RELEASE_FILE"
test -f "$RELEASE_FILE"
cat "$RELEASE_FILE"

echo "Aqui se integrara la actualizacion automatica mensual"
echo "Update completado"