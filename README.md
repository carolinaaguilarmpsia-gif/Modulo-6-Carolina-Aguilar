# Integración de un Modelo de Lenguaje (LLM) — Peldaño 0

Proyecto base: **SGAI — Sistema de Gestión Académica Integral**. Este repositorio contiene el código de la tarea de integración de un LLM (invocación desde código, no desde un chat web), agregado sobre la implementación existente de SGAI (backend Node.js/TypeScript + Express, frontend React/Vite).

## Qué hay acá

- `backend/domain/asistente-ia/` — puerto `ILlmClient` y el servicio `SugerirTipoDJService`, que arma un prompt a partir de datos reales de una Declaración Jurada.
- `backend/infrastructure/ai/` — adaptadores reales: `OllamaClient` (modelo local, `llama3.2:3b`) y `GroqClient` (nube, tier gratis, `llama-3.1-8b-instant`).
- `backend/scripts/demo-llm.ts` — demo mínima: crea una Declaración Jurada real y le pide al modelo que valide su tipo.
- `backend/scripts/comparar-modelos.ts` — bonus: corre el mismo prompt por los dos modelos y compara tiempos de respuesta.

## Cómo correrlo

```bash
npm install --prefix backend
npm install --prefix frontend

cp backend/.env.example backend/.env
# completar backend/.env con tu GROQ_API_KEY (gratis, sin tarjeta: https://console.groq.com/keys)
# Ollama debe estar corriendo local con el modelo descargado:
#   ollama pull llama3.2:3b

npm run demo:llm             # demo mínima (peldaño 0)
npm run demo:llm:comparar    # bonus: comparación de dos modelos

npm run dev:api              # backend en :3001
npm run dev:web              # frontend en :5173
```

## Seguridad

Ningún archivo `.env` está en este repositorio (ver `.gitignore`). Las API keys se configuran localmente a partir de `backend/.env.example`.
