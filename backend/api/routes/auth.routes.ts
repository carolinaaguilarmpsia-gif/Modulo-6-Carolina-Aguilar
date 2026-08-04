import { Router } from 'express';
import type { AuthController } from '../controllers/auth.controller.js';
import { authRateLimit } from '../middleware/authRateLimit.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { correlationIdMiddleware } from '../middleware/auth.middleware.js';
import { validateBody } from '../validators/dj.validator.js';
import { LoginSchema } from '../validators/auth.validator.js';

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();

  router.use(correlationIdMiddleware);
  router.post('/login', authRateLimit, validateBody(LoginSchema), asyncHandler(controller.login));

  return router;
}
