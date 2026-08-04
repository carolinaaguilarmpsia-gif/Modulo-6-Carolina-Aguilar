import type { Response } from 'express';
import type { AutenticarUsuarioUseCase } from '../../domain/administracion/ports/in/AutenticarUsuarioUseCase.js';
import type { LoginSchema } from '../validators/auth.validator.js';
import type { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';

type LoginRequest = AuthenticatedRequest & { validatedBody: z.infer<typeof LoginSchema> };

export class AuthController {
  constructor(private readonly service: AutenticarUsuarioUseCase) {}

  login = async (req: LoginRequest, res: Response): Promise<void> => {
    const { email, password } = req.validatedBody;
    const result = await this.service.autenticar({ email, password, ip: req.ip });

    res.json({
      token: result.token,
      rol: result.rol,
      nombreCompleto: result.nombreCompleto,
      facultadId: result.facultadId,
      correlationId: req.correlationId,
    });
  };
}
