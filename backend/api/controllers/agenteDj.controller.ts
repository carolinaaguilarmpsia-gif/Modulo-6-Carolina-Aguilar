import type { Response } from 'express';
import type { z } from 'zod';
import type { AgenteDJService } from '../../domain/agente-dj/services/AgenteDJService.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import type { ConfirmarAgenteDjSchema, PreguntarAgenteDjSchema } from '../validators/agenteDj.validator.js';

type PreguntarRequest = AuthenticatedRequest & { validatedBody: z.infer<typeof PreguntarAgenteDjSchema> };
type ConfirmarRequest = AuthenticatedRequest & { validatedBody: z.infer<typeof ConfirmarAgenteDjSchema> };

export class AgenteDjController {
  constructor(private readonly service: AgenteDJService) {}

  preguntar = async (req: PreguntarRequest, res: Response): Promise<void> => {
    const actor = { userId: req.user.userId, rol: req.user.rol, facultadId: req.user.facultadId };
    const resultado = await this.service.preguntar(actor, req.validatedBody.pregunta);
    res.json({ ...resultado, correlationId: req.correlationId });
  };

  confirmar = async (req: ConfirmarRequest, res: Response): Promise<void> => {
    const actor = { userId: req.user.userId, rol: req.user.rol, facultadId: req.user.facultadId };
    const { sessionId, confirmar } = req.validatedBody;
    const resultado = await this.service.confirmar(actor, sessionId, confirmar);
    res.json({ ...resultado, correlationId: req.correlationId });
  };
}
