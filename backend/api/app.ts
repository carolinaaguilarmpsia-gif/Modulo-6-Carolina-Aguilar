import { randomBytes } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { DeclaracionJuradaService } from '../domain/declaracion-jurada/services/DeclaracionJuradaService.js';
import { AutenticarUsuarioService } from '../domain/administracion/services/AutenticarUsuarioService.js';
import { ConsoleNotificacionPublisher } from '../infrastructure/notifications/ConsoleNotificacionPublisher.js';
import { InMemoryDeclaracionJuradaRepository } from '../infrastructure/persistence/InMemoryDeclaracionJuradaRepository.js';
import { InMemoryUsuarioRepository } from '../infrastructure/persistence/InMemoryUsuarioRepository.js';
import { BcryptPasswordHasher } from '../infrastructure/auth/BcryptPasswordHasher.js';
import { JwtSigner } from '../infrastructure/auth/JwtSigner.js';
import { LdapUnavailableAuthenticator } from '../infrastructure/auth/LdapUnavailableAuthenticator.js';
import { AuthController } from './controllers/auth.controller.js';
import { DjController } from './controllers/dj.controller.js';
import { globalErrorHandler } from './middleware/auth.middleware.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createDjRouter } from './routes/dj.routes.js';

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
const authService = new AutenticarUsuarioService(
  usuarioRepository,
  new LdapUnavailableAuthenticator(),
  new BcryptPasswordHasher(),
  new JwtSigner(jwtSecret)
);
const authController = new AuthController(authService);

export const app = express();

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', module: 'sgai-api' });
});

app.use('/api/v1/auth', createAuthRouter(authController));
app.use('/api/v1/declaraciones-juradas', createDjRouter(controller));

app.use(globalErrorHandler);
