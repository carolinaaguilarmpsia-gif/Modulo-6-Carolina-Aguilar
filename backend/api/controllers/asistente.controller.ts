import type { Response } from 'express';
import type { z } from 'zod';
import { ForbiddenError } from '../../domain/shared/errors/DomainError.js';
import { Rol } from '../../domain/administracion/types/Rol.js';
import type { ResponderConsultaDJService } from '../../domain/asistente-ia/services/ResponderConsultaDJService.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import type { ValidarDJSchema } from '../validators/asistente.validator.js';

type ValidarDJRequest = AuthenticatedRequest & { validatedBody: z.infer<typeof ValidarDJSchema> };

export class AsistenteController {
  constructor(private readonly service: ResponderConsultaDJService) {}

  validarDJ = async (req: ValidarDJRequest, res: Response): Promise<void> => {
    if (req.user.rol !== Rol.ADMIN_FACULTAD) {
      throw new ForbiddenError('INSUFFICIENT_ROLE', { rol: req.user.rol, requerido: Rol.ADMIN_FACULTAD });
    }

    const resultado = await this.service.responder(req.validatedBody);

    res.json({
      dj: resultado.dj,
      respuestaModelo: resultado.respuestaModelo,
      correlationId: req.correlationId,
    });
  };
}
