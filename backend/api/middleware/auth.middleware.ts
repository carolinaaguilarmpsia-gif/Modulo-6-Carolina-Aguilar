import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { DomainError, UnauthorizedError, ForbiddenError } from '../../domain/shared/errors/DomainError.js';
import type { IJwtSigner } from '../../domain/administracion/ports/out/IJwtSigner.js';
import { Rol } from '../../domain/administracion/types/Rol.js';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  rol: Rol;
  facultadId: string;
  vinculacionActiva: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  correlationId: string;
}

/** Asigna correlationId sin simular usuario — usar en endpoints públicos (p. ej. POST /auth/login). */
export function correlationIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  (req as AuthenticatedRequest).correlationId = (req.headers['x-correlation-id'] as string) ?? randomUUID();
  next();
}

/**
 * RBAC real — reemplaza a `demoAuthMiddleware` fuera de `dev`.
 * Verifica el JWT emitido por `AutenticarUsuarioService` (PR-IMPL-003/004) y el rol permitido.
 * @see FSD-UC-001 · DD-UC-002
 */
export function requireRole(jwtSigner: IJwtSigner, rolesPermitidos: Rol[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const ar = req as AuthenticatedRequest;
    ar.correlationId = (req.headers['x-correlation-id'] as string) ?? randomUUID();

    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedError('TOKEN_INVALID');
    }

    const payload = jwtSigner.verify(header.slice('Bearer '.length));

    if (!rolesPermitidos.includes(payload.rol)) {
      throw new ForbiddenError('INSUFFICIENT_ROLE', { rol: payload.rol, rolesPermitidos });
    }

    ar.user = {
      userId: payload.userId,
      email: payload.email,
      rol: payload.rol,
      facultadId: payload.facultadId,
      vinculacionActiva: true,
    };
    next();
  };
}

/** Demo auth — header X-SGAI-Demo-User: docente | admin_facultad | tecnico_dpa */
export function demoAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ar = req as AuthenticatedRequest;
  ar.correlationId = (req.headers['x-correlation-id'] as string) ?? randomUUID();

  const demoUser = (req.headers['x-sgai-demo-user'] as string) ?? 'docente';
  const inactive = req.headers['x-sgai-demo-inactive'] === '1';

  const FACULTAD_ID = 'facultad-demo-001';

  const profiles: Record<string, AuthenticatedUser> = {
    docente: {
      userId: 'docente-demo-001',
      email: 'docente@universidad.edu.bo',
      rol: Rol.DOCENTE,
      facultadId: FACULTAD_ID,
      vinculacionActiva: !inactive,
    },
    admin_facultad: {
      userId: 'admin-fac-demo-001',
      email: 'admin.facultad@universidad.edu.bo',
      rol: Rol.ADMIN_FACULTAD,
      facultadId: FACULTAD_ID,
      vinculacionActiva: true,
    },
    tecnico_dpa: {
      userId: 'dpa-demo-001',
      email: 'dpa@universidad.edu.bo',
      rol: Rol.TECNICO_DPA,
      facultadId: FACULTAD_ID,
      vinculacionActiva: true,
    },
  };

  ar.user = profiles[demoUser] ?? profiles.docente;
  next();
}

export function globalErrorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const correlationId = (req as AuthenticatedRequest).correlationId ?? 'unknown';

  if (err instanceof DomainError) {
    res.status(err.httpStatus).json({
      error: err.code,
      message: err.message,
      correlationId,
    });
    return;
  }

  console.error('Unhandled error', { correlationId, type: err.constructor.name });
  res.status(500).json({ error: 'INTERNAL_ERROR', correlationId });
}
