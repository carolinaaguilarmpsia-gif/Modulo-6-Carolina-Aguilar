import { Router } from 'express';
import type { DjController } from '../controllers/dj.controller.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { demoAuthMiddleware } from '../middleware/auth.middleware.js';
import { CreateDjSchema, TransicionDjSchema, UpdateDjCamposSchema, validateBody } from '../validators/dj.validator.js';

export function createDjRouter(controller: DjController): Router {
  const router = Router();

  router.use(demoAuthMiddleware);

  router.get('/', asyncHandler(controller.list));
  router.post('/', validateBody(CreateDjSchema), asyncHandler(controller.create));
  router.get('/:id', asyncHandler(controller.getById));
  router.patch('/:id', validateBody(UpdateDjCamposSchema), asyncHandler(controller.updateCampos));
  router.patch('/:id/estado', validateBody(TransicionDjSchema), asyncHandler(controller.transicionarEstado));

  return router;
}
