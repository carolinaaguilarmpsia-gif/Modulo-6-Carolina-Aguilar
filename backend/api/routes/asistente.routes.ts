import { Router } from 'express';
import type { AsistenteController } from '../controllers/asistente.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { demoAuthMiddleware } from '../middleware/auth.middleware.js';
import { validateBody } from '../validators/dj.validator.js';
import { ValidarDJSchema } from '../validators/asistente.validator.js';

export function createAsistenteRouter(controller: AsistenteController): Router {
  const router = Router();

  router.use(demoAuthMiddleware);
  router.post('/validar-dj', validateBody(ValidarDJSchema), asyncHandler(controller.validarDJ));

  return router;
}
