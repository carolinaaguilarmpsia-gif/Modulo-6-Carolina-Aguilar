# SGAI — Sistema de Gestión Académica con IA

Módulo de Declaraciones Juradas (DJ) del personal académico de la UMSS: seguimiento con
máquina de estados, un asistente de trámites con búsqueda semántica (RAG), un agente que
propone y ejecuta aprobaciones vía protocolo MCP, y un orquestador de atención con estado
persistente. Backend en Node.js/TypeScript + Express, frontend en React/Vite.

Ver `docs/entrega-ia/M6_Documento_Final_Presentacion_SGAI.docx` para el detalle completo de
arquitectura, niveles de integración de IA implementados y evidencias.

## Qué hay acá

- `backend/domain/declaracion-jurada/` — máquina de estados de la DJ (RBAC por rol, RB-01/03/06).
- `backend/domain/tramites-dpa/` — asistente de trámites: keyword → RAG (embeddings) → LLM-router → fallback.
- `backend/domain/agente-dj/` + `backend/infrastructure/mcp/` — agente MCP real (SDK oficial) para aprobar/rechazar DJ, con preview y confirmación humana.
- `backend/domain/orquestador-atencion/` — orquestador de atención: clasificación de intención, ramas de negocio, estado persistido en disco.
- `backend/domain/administracion/` — autenticación JWT y búsqueda de docentes (con sugerencias por distancia de edición).
- `backend/domain/asistente-ia/` — "peldaño 0": primer uso de un LLM invocado desde código (`SugerirTipoDJService`).

## Cómo correrlo

```bash
# 1) instalar dependencias
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 2) configurar variables de entorno
cp backend/.env.example backend/.env
# completar GROQ_API_KEY en backend/.env (https://console.groq.com/keys, tier gratis)

# 3) modelos locales de Ollama (una sola vez)
ollama pull nomic-embed-text   # necesario para el RAG (embeddings)
ollama pull llama3.2:3b        # necesario para el asistente "peldaño 0" y demos

# 4) levantar backend (:3001) y frontend (:5173) juntos
npm run dev:dj

# demos puntuales
npm run demo:llm             # peldaño 0 — invocación mínima del LLM
npm run demo:llm:comparar    # bonus: compara Ollama vs Groq

# tests automatizados (61 tests, 10 suites)
npm run test:domain
```

## Seguridad

Ningún archivo `.env` está en este repositorio (ver `.gitignore`). Las API keys se
configuran localmente a partir de `backend/.env.example`. Los modelos de Groq rotan —
si `GROQ_MODEL` da un error `model_not_found`, revisar los modelos vigentes para tu cuenta
en https://console.groq.com/docs/models.
