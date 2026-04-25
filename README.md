# agentec-catalog

Catálogo oficial de releases, profiles, skills y tools aprobadas para AgenTEC/OpenClaw.

## Objetivo
Definir qué combinación de tools y skills puede instalarse o activarse en una instancia de OpenClaw.

## Flujo
1. Los equipos desarrollan en agentec-tools y agentec-skills
2. Se aprueban versiones
3. El catálogo referencia esas versiones
4. OpenClaw consume el release aprobado

## Set reusable local actual

El catálogo queda preparado para un set reusable local con cuatro unidades funcionales:

- `web-login-monitor`
- `web-login-monitor-py`
- `graph-mail`
- `graph-files`

Y sus tools equivalentes:

- `web-login-playwright`
- `web-login-playwright-py`
- `graph-mail`
- `graph-files`

La configuración sensible vive fuera del catálogo, en `.env` y `config/` del stack.