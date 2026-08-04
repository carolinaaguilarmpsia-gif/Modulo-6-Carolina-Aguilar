import type { Rol } from './Rol.js';

/**
 * @see DTI vFinal §4.3 · FSD-UC-001
 * NUNCA incluir `ci`, `password`, `password_hash` ni datos financieros (Ley 164).
 */
export interface JwtPayload {
  userId: string;
  email: string;
  rol: Rol;
  facultadId: string;
  iat?: number;
  exp?: number;
}

export interface LoginResult {
  token: string;
  rol: Rol;
  nombreCompleto: string;
  facultadId: string;
}
