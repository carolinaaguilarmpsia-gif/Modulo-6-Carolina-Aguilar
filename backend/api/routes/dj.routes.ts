import { Router } from 'express';
import type { DjController } from '../controllers/dj.controller.js';
import type { IJwtSigner } from '../../domain/administracion/ports/out/IJwtSigner.js';
import type { IUsuarioRepository } from '../../domain/administracion/ports/out/IUsuarioRepository.js';
import { Rol } from '../../domain/administracion/types/Rol.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireRole } from '../middleware/auth.middleware.js';
import { CreateDjSchema, TransicionDjSchema, UpdateDjCamposSchema, validateBody } from '../validators/dj.validator.js';

const TODOS_LOS_ROLES = [Rol.DOCENTE, Rol.ADMIN_FACULTAD, Rol.TECNICO_DPA, Rol.ADMIN_SISTEMA];

/**
 * Login real (JWT), no demoAuthMiddleware — la identidad del docente que crea/edita una DJ
 * es la del usuario autenticado. La autorización fina por rol/facultad/dueño sigue en
 * DeclaracionJuradaService, esta capa solo exige "estar autenticado con alguno de estos roles".
 */
export function createDjRouter(controller: DjController, jwtSigner: IJwtSigner, usuarios: IUsuarioRepository): Router {
  const router = Router();

  router.use(requireRole(jwtSigner, usuarios, TODOS_LOS_ROLES));

  router.get('/', asyncHandler(controller.list));
  router.post('/', validateBody(CreateDjSchema), asyncHandler(controller.create));
  router.get('/:id', asyncHandler(controller.getById));
  router.patch('/:id', validateBody(UpdateDjCamposSchema), asyncHandler(controller.updateCampos));
  router.patch('/:id/estado', validateBody(TransicionDjSchema), asyncHandler(controller.transicionarEstado));

  return router;
}
