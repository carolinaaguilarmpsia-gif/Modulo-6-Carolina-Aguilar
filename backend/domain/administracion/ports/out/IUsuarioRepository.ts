import type { Usuario } from '../../entities/Usuario.js';

/**
 * Puerto de salida — persistencia de usuarios.
 * @see RB-07 — implementación MUST persistir intentosFallidos/bloqueadoHasta de forma atómica
 */
export interface IUsuarioRepository {
  findByEmail(email: string): Promise<Usuario | null>;
  registrarIntentoFallido(userId: string, params: { intentosFallidos: number; bloqueadoHasta: Date | null }): Promise<void>;
  registrarLoginExitoso(userId: string): Promise<void>;
}
