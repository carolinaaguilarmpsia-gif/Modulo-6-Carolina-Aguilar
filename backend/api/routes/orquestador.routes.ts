import { Router } from 'express';
import type { OrquestadorController } from '../controllers/orquestador.controller.js';
import type { IJwtSigner } from '../../domain/administracion/ports/out/IJwtSigner.js';
import type { IUsuarioRepository } from '../../domain/administracion/ports/out/IUsuarioRepository.js';
import { Rol } from '../../domain/administracion/types/Rol.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireRole } from '../middleware/auth.middleware.js';
import { validateBody } from '../validators/dj.validator.js';
import { AtenderOrquestadorSchema } from '../validators/orquestador.validator.js';

/** Quien tenga sesión puede usar el chat de atención — la rama por rol vive dentro del orquestador. */
const ROLES_ORQUESTADOR = [Rol.DOCENTE, Rol.ADMIN_FACULTAD, Rol.TECNICO_DPA];

export function createOrquestadorRouter(controller: OrquestadorController, jwtSigner: IJwtSigner, usuarios: IUsuarioRepository): Router {
  const router = Router();

  router.use(requireRole(jwtSigner, usuarios, ROLES_ORQUESTADOR));
  router.post('/atender', validateBody(AtenderOrquestadorSchema), asyncHandler(controller.atender));

  return router;
}
