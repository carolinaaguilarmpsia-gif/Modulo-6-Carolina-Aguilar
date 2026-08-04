import type { JwtPayload } from '../../types/JwtPayload.js';

/** Puerto de salida — emisión y verificación de JWT. @see NFR-006 (expiración <= 8h) */
export interface IJwtSigner {
  sign(payload: Omit<JwtPayload, 'iat' | 'exp'>): string;
  verify(token: string): JwtPayload;
}
