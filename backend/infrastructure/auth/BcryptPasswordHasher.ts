import bcrypt from 'bcryptjs';
import type { IPasswordHasher } from '../../domain/administracion/ports/out/IPasswordHasher.js';

const COST_FACTOR = 12; // @see DTI vFinal §13.2 — bcrypt cost >= 12

/**
 * Implementación real con `bcryptjs` (puro JS, sin bindings nativos).
 * Sustitución de implementación respecto al DTI (que menciona el paquete `bcrypt`):
 * mismo algoritmo bcrypt y mismo cost factor >= 12, sin dependencia de compilación nativa.
 * No es un delta arquitectónico — ver DD-UC-002 §4 (actualizado al ejecutar PR-IMPL-004).
 */
export class BcryptPasswordHasher implements IPasswordHasher {
  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, COST_FACTOR);
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
