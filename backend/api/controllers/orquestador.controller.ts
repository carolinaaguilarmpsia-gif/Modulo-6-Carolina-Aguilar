import type { Response } from 'express';
import type { z } from 'zod';
import type { OrquestadorAtencionService } from '../../domain/orquestador-atencion/services/OrquestadorAtencionService.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import type { AtenderOrquestadorSchema } from '../validators/orquestador.validator.js';

type AtenderRequest = AuthenticatedRequest & { validatedBody: z.infer<typeof AtenderOrquestadorSchema> };

export class OrquestadorController {
  constructor(private readonly service: OrquestadorAtencionService) {}

  atender = async (req: AtenderRequest, res: Response): Promise<void> => {
    const actor = { userId: req.user.userId, rol: req.user.rol, facultadId: req.user.facultadId };
    const resultado = await this.service.atender(actor, req.validatedBody);
    res.json({ ...resultado, correlationId: req.correlationId });
  };
}
