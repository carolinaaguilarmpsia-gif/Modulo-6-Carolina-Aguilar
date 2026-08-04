import jwt from 'jsonwebtoken';
import type { IJwtSigner } from '../../domain/administracion/ports/out/IJwtSigner.js';
import type { JwtPayload } from '../../domain/administracion/types/JwtPayload.js';
import { UnauthorizedError } from '../../domain/shared/errors/DomainError.js';

const EXPIRACION = '8h'; // NFR-006 — sesión <= 8 horas

/** Implementación real con `jsonwebtoken` (HS256). @see DTI vFinal §13.2 */
export class JwtSigner implements IJwtSigner {
  constructor(private readonly secret: string) {
    if (!secret) {
      throw new Error('JWT_SECRET no configurado — ver validateEnvOnStartup()');
    }
  }

  sign(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.secret, { algorithm: 'HS256', expiresIn: EXPIRACION });
  }

  verify(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.secret, { algorithms: ['HS256'] }) as JwtPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('TOKEN_EXPIRED');
      }
      throw new UnauthorizedError('TOKEN_INVALID');
    }
  }
}
