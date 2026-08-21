import type { Request, Response } from 'express';
import type { z } from 'zod';
import type { AsistenteTramitesService } from '../../domain/tramites-dpa/services/AsistenteTramitesService.js';
import type { AsistenteTramitesSchema } from '../validators/asistenteTramites.validator.js';

type PreguntarRequest = Request & {
  validatedBody: z.infer<typeof AsistenteTramitesSchema>;
  correlationId: string;
};

/** Endpoint público (sin login) — chat de trámites DPA visible en la pantalla de login. */
export class AsistenteTramitesController {
  constructor(private readonly service: AsistenteTramitesService) {}

  preguntar = async (req: PreguntarRequest, res: Response): Promise<void> => {
    const resultado = await this.service.preguntar(req.validatedBody.pregunta);
    res.json({ ...resultado, correlationId: req.correlationId });
  };

  estado = async (req: Request & { correlationId: string }, res: Response): Promise<void> => {
    res.json({ ...this.service.estado(), correlationId: req.correlationId });
  };
}
