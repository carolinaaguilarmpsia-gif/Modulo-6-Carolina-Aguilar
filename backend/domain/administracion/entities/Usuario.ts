import type { Rol } from '../types/Rol.js';

/** Agregado Usuario — sin dependencias de infraestructura. @see FSD-UC-001 */
export interface Usuario {
  id: string;
  email: string;
  nombreCompleto: string;
  /** Hash bcrypt — fallback local cuando LDAP no está disponible (DTI §13.2) */
  passwordHashLocal: string;
  rol: Rol;
  facultadId: string;
  vinculacionActiva: boolean;
  /** RB-07 — contador de intentos fallidos consecutivos */
  intentosFallidos: number;
  /** RB-07 — si es una fecha futura, el login debe rechazarse sin validar password */
  bloqueadoHasta: Date | null;
}
