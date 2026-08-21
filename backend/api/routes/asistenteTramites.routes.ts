import { Router } from 'express';
import type { AsistenteTramitesController } from '../controllers/asistenteTramites.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { correlationIdMiddleware } from '../middleware/auth.middleware.js';
import { validateBody } from '../validators/dj.validator.js';
import { AsistenteTramitesSchema } from '../validators/asistenteTramites.validator.js';

/** Sin auth — es el asistente que se ve en la pantalla de login, antes de iniciar sesión. */
export function createAsistenteTramitesRouter(controller: AsistenteTramitesController): Router {
  const router = Router();

  router.use(correlationIdMiddleware);
  router.get('/estado', asyncHandler(controller.estado));
  router.post('/preguntar', validateBody(AsistenteTramitesSchema), asyncHandler(controller.preguntar));

  return router;
}
