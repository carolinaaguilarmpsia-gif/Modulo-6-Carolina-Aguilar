import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { DeclaracionJuradaService } from '../domain/declaracion-jurada/services/DeclaracionJuradaService.js';
import { AutenticarUsuarioService } from '../domain/administracion/services/AutenticarUsuarioService.js';
import { ResponderConsultaDJService } from '../domain/asistente-ia/services/ResponderConsultaDJService.js';
import { AsistenteTramitesService } from '../domain/tramites-dpa/services/AsistenteTramitesService.js';
import { AgenteDJService } from '../domain/agente-dj/services/AgenteDJService.js';
import type { AgentLlmTurn, AgentMessage, AgentToolDef } from '../domain/agente-dj/types/Agente.js';
import { ConsoleNotificacionPublisher } from '../infrastructure/notifications/ConsoleNotificacionPublisher.js';
import { InMemoryDeclaracionJuradaRepository } from '../infrastructure/persistence/InMemoryDeclaracionJuradaRepository.js';
import { InMemoryUsuarioRepository } from '../infrastructure/persistence/InMemoryUsuarioRepository.js';
import { InMemoryAgenteSessionStore } from '../infrastructure/persistence/InMemoryAgenteSessionStore.js';
import { JsonTramiteRepository } from '../infrastructure/persistence/JsonTramiteRepository.js';
import { BcryptPasswordHasher } from '../infrastructure/auth/BcryptPasswordHasher.js';
import { JwtSigner } from '../infrastructure/auth/JwtSigner.js';
import { LdapUnavailableAuthenticator } from '../infrastructure/auth/LdapUnavailableAuthenticator.js';
import { GroqClient } from '../infrastructure/ai/GroqClient.js';
import { GroqAgentClient } from '../infrastructure/ai/GroqAgentClient.js';
import { InProcessMcpToolClientFactory } from '../infrastructure/mcp/InProcessMcpToolClient.js';
import { loadEnvFile } from '../infrastructure/config/loadEnv.js';
import { AsistenteController } from './controllers/asistente.controller.js';
import { AsistenteTramitesController } from './controllers/asistenteTramites.controller.js';
import { AgenteDjController } from './controllers/agenteDj.controller.js';
import { AuthController } from './controllers/auth.controller.js';
import { DjController } from './controllers/dj.controller.js';
import { globalErrorHandler } from './middleware/auth.middleware.js';
import { createAsistenteRouter } from './routes/asistente.routes.js';
import { createAsistenteTramitesRouter } from './routes/asistenteTramites.routes.js';
import { createAgenteDjRouter } from './routes/agenteDj.routes.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createDjRouter } from './routes/dj.routes.js';

// Ruta absoluta relativa a este archivo (backend/api/app.ts), no a process.cwd() —
// el server se invoca a veces desde la raíz del repo, a veces desde backend/, y
// process.cwd() cambia según eso; import.meta.url no.
const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnvFile(resolve(__dirname, '../.env'));

const repository = new InMemoryDeclaracionJuradaRepository();
const service = new DeclaracionJuradaService(repository, new ConsoleNotificacionPublisher());
const controller = new DjController(service);

// @see docs/SKILLS/auth-rbac-guard.md — MUST NOT hardcodear secretos.
// Sin JWT_SECRET en .env, se genera uno efímero por proceso (válido solo para esta demo local).
let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  jwtSecret = randomBytes(32).toString('hex');
  console.warn('[SGAI] JWT_SECRET no configurado en .env — usando secreto efímero solo para desarrollo local.');
}

const usuarioRepository = new InMemoryUsuarioRepository();
const jwtSigner = new JwtSigner(jwtSecret);
const authService = new AutenticarUsuarioService(
  usuarioRepository,
  new LdapUnavailableAuthenticator(),
  new BcryptPasswordHasher(),
  jwtSigner
);
const authController = new AuthController(authService);

/**
 * GroqClient valida GROQ_API_KEY en su constructor. Instanciarlo perezoso (recién al primer
 * request a /asistente) evita que la API entera falle al arrancar si todavía no se configuró
 * la key — las rutas de DJ y auth no dependen de esto.
 */
class LazyGroqClient {
  preguntar(prompt: string): Promise<string> {
    return new GroqClient().preguntar(prompt);
  }
}

const asistenteController = new AsistenteController(
  new ResponderConsultaDJService(usuarioRepository, repository, new LazyGroqClient())
);

// Feature flag del asistente de trámites DPA — con IA_HABILITADA=false, el router nunca
// llega a instanciar/llamar al LLM (ni falla si no hay GROQ_API_KEY): el camino keyword
// sigue respondiendo igual, solo cambia si el fallback puede resolver preguntas por sinónimo.
const iaTramitesHabilitada = process.env.IA_HABILITADA !== 'false';
const tramiteRepository = new JsonTramiteRepository(resolve(__dirname, '../data/db.json'));
const asistenteTramitesService = new AsistenteTramitesService(
  tramiteRepository,
  iaTramitesHabilitada ? new LazyGroqClient() : null,
  iaTramitesHabilitada
);
const asistenteTramitesController = new AsistenteTramitesController(asistenteTramitesService);

/** Mismo patrón lazy que LazyGroqClient — no falla el boot si falta GROQ_API_KEY. */
class LazyGroqAgentClient {
  siguienteTurno(mensajes: AgentMessage[], herramientas: AgentToolDef[]): Promise<AgentLlmTurn> {
    return new GroqAgentClient().siguienteTurno(mensajes, herramientas);
  }
}

const agenteDjSessionStore = new InMemoryAgenteSessionStore();
const agenteDjToolClientFactory = new InProcessMcpToolClientFactory({ djService: service, usuarios: usuarioRepository });
const agenteDjService = new AgenteDJService(new LazyGroqAgentClient(), agenteDjToolClientFactory, agenteDjSessionStore);
const agenteDjController = new AgenteDjController(agenteDjService);

export const app = express();

// 5173/5174: Vite salta al siguiente puerto libre si el 5173 ya está ocupado por otra cosa.
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
    ],
  })
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', module: 'sgai-api' });
});

app.use('/api/v1/auth', createAuthRouter(authController));
app.use('/api/v1/declaraciones-juradas', createDjRouter(controller, jwtSigner, usuarioRepository));
app.use('/api/v1/asistente', createAsistenteRouter(asistenteController));
app.use('/api/v1/asistente-tramites', createAsistenteTramitesRouter(asistenteTramitesController));
app.use('/api/v1/agente-dj', createAgenteDjRouter(agenteDjController, jwtSigner, usuarioRepository));

app.use(globalErrorHandler);
