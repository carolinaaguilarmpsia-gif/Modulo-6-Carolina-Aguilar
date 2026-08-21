import { Router } from 'express';
import type { AgenteDjController } from '../controllers/agenteDj.controller.js';
import type { IJwtSigner } from '../../domain/administracion/ports/out/IJwtSigner.js';
import type { IUsuarioRepository } from '../../domain/administracion/ports/out/IUsuarioRepository.js';
import { Rol } from '../../domain/administracion/types/Rol.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireRole } from '../middleware/auth.middleware.js';
import { validateBody } from '../validators/dj.validator.js';
import { ConfirmarAgenteDjSchema, PreguntarAgenteDjSchema } from '../validators/agenteDj.validator.js';

/** Solo quienes pueden aprobar/rechazar DJs — el agente propone transiciones que ellos confirman. */
const ROLES_AGENTE = [Rol.ADMIN_FACULTAD, Rol.TECNICO_DPA];

export function createAgenteDjRouter(controller: AgenteDjController, jwtSigner: IJwtSigner, usuarios: IUsuarioRepository): Router {
  const router = Router();

  router.use(requireRole(jwtSigner, usuarios, ROLES_AGENTE));
  router.post('/preguntar', validateBody(PreguntarAgenteDjSchema), asyncHandler(controller.preguntar));
  router.post('/confirmar', validateBody(ConfirmarAgenteDjSchema), asyncHandler(controller.confirmar));

  return router;
}
