import bcrypt from 'bcryptjs';
import type { Usuario } from '../../domain/administracion/entities/Usuario.js';
import type { IUsuarioRepository } from '../../domain/administracion/ports/out/IUsuarioRepository.js';
import { Rol } from '../../domain/administracion/types/Rol.js';
import {
  DOCENTE_ANDREA_QUISPE_ID,
  DOCENTE_CARLOS_PAZ_ID,
  DOCENTE_DEMO_ID,
  DOCENTE_JUAN_JALDIN_ID,
  DOCENTE_MARIA_ROJAS_ID,
  DOCENTE_PEDRO_FERNANDEZ_ID,
  FACULTAD_ECONOMICAS_ID,
  FACULTAD_TECNOLOGIA_ID,
} from './seedIds.js';

/**
 * Usuarios semilla de desarrollo — 2 facultades, un Admin. Facultad por cada una, y varios
 * docentes que cubren los escenarios de declaración jurada (DJ) que ejercita la demo:
 *   - Juan Jaldín      → tiene exactamente 1 DJ (facultad Económicas)
 *   - María Rojas      → tiene más de 1 DJ (una aprobada de una gestión pasada + una en curso)
 *   - Andrea Quispe    → no tiene ninguna DJ todavía (facultad Tecnología)
 *   - Pedro Fernández  → dicta en las 2 facultades: tiene una DJ en cada una, revisada por el
 *                        Admin. Facultad correspondiente (demuestra el guard "misma facultad")
 * Password de todos: `Demo1234!`
 * @see seedDeclaracionesJuradas.ts — las DJ de estos docentes
 */
function usuariosSemilla(): Usuario[] {
  const passwordHashDemo = bcrypt.hashSync('Demo1234!', 12);

  return [
    {
      id: DOCENTE_DEMO_ID,
      email: 'docente@universidad.edu.bo',
      nombreCompleto: 'Docente Demo',
      passwordHashLocal: passwordHashDemo,
      rol: Rol.DOCENTE,
      facultadId: FACULTAD_ECONOMICAS_ID,
      vinculacionActiva: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    },
    {
      id: 'admin-fac-demo-001',
      email: 'admin.facultad@universidad.edu.bo',
      nombreCompleto: 'Admin. Facultad Económicas',
      passwordHashLocal: passwordHashDemo,
      rol: Rol.ADMIN_FACULTAD,
      facultadId: FACULTAD_ECONOMICAS_ID,
      vinculacionActiva: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    },
    {
      id: 'admin-fac-tecnologia-001',
      email: 'admin.tecnologia@universidad.edu.bo',
      nombreCompleto: 'Admin. Facultad Tecnología',
      passwordHashLocal: passwordHashDemo,
      rol: Rol.ADMIN_FACULTAD,
      facultadId: FACULTAD_TECNOLOGIA_ID,
      vinculacionActiva: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    },
    {
      // TECNICO_DPA revisa a nivel institucional, no por facultad — su facultadId no
      // condiciona ninguna regla de la máquina de estados (@see DJStateMachine REGLAS).
      id: 'dpa-demo-001',
      email: 'dpa@universidad.edu.bo',
      nombreCompleto: 'Técnico DPA Demo',
      passwordHashLocal: passwordHashDemo,
      rol: Rol.TECNICO_DPA,
      facultadId: FACULTAD_ECONOMICAS_ID,
      vinculacionActiva: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    },
    {
      id: 'admin-sys-demo-001',
      email: 'admin.sistema@universidad.edu.bo',
      nombreCompleto: 'Admin. Sistema Demo',
      passwordHashLocal: passwordHashDemo,
      rol: Rol.ADMIN_SISTEMA,
      facultadId: FACULTAD_ECONOMICAS_ID,
      vinculacionActiva: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    },
    {
      // Escenario "1 declaración jurada" — @see seedDeclaracionesJuradas.ts
      id: DOCENTE_JUAN_JALDIN_ID,
      email: 'juan.jaldin@universidad.edu.bo',
      nombreCompleto: 'Juan Jaldín',
      passwordHashLocal: passwordHashDemo,
      rol: Rol.DOCENTE,
      facultadId: FACULTAD_ECONOMICAS_ID,
      vinculacionActiva: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    },
    {
      // Vinculación inactiva a propósito: demuestra RB-01 con una cuenta real
      // (reemplaza al checkbox "simular sin vinculación activa" del puente demo anterior).
      id: DOCENTE_CARLOS_PAZ_ID,
      email: 'carlos.paz@universidad.edu.bo',
      nombreCompleto: 'Carlos Paz',
      passwordHashLocal: passwordHashDemo,
      rol: Rol.DOCENTE,
      facultadId: FACULTAD_TECNOLOGIA_ID,
      vinculacionActiva: false,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    },
    {
      // Escenario "más de 1 declaración jurada" — @see seedDeclaracionesJuradas.ts
      id: DOCENTE_MARIA_ROJAS_ID,
      email: 'maria.rojas@universidad.edu.bo',
      nombreCompleto: 'María Rojas',
      passwordHashLocal: passwordHashDemo,
      rol: Rol.DOCENTE,
      facultadId: FACULTAD_ECONOMICAS_ID,
      vinculacionActiva: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    },
    {
      // Escenario "sin declaración jurada" — vinculación activa, cero DJ creadas todavía.
      id: DOCENTE_ANDREA_QUISPE_ID,
      email: 'andrea.quispe@universidad.edu.bo',
      nombreCompleto: 'Andrea Quispe',
      passwordHashLocal: passwordHashDemo,
      rol: Rol.DOCENTE,
      facultadId: FACULTAD_TECNOLOGIA_ID,
      vinculacionActiva: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    },
    {
      // Escenario "docente que dicta en 2 facultades" — su facultadId "de origen" es Económicas
      // (la que usa el sistema al crear una DJ nueva desde su login), pero ya tiene una DJ
      // vigente en cada facultad — @see seedDeclaracionesJuradas.ts.
      id: DOCENTE_PEDRO_FERNANDEZ_ID,
      email: 'pedro.fernandez@universidad.edu.bo',
      nombreCompleto: 'Pedro Fernández',
      passwordHashLocal: passwordHashDemo,
      rol: Rol.DOCENTE,
      facultadId: FACULTAD_ECONOMICAS_ID,
      vinculacionActiva: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    },
  ];
}

/** Repositorio in-memory — demo/desarrollo sin PostgreSQL. @see DD-UC-002 §4 (reemplazar por PrismaUsuarioRepository) */
export class InMemoryUsuarioRepository implements IUsuarioRepository {
  private readonly store = new Map<string, Usuario>(usuariosSemilla().map((u) => [u.email, u]));

  async findByEmail(email: string): Promise<Usuario | null> {
    const usuario = this.store.get(email);
    return usuario ? { ...usuario } : null;
  }

  async listar(): Promise<Usuario[]> {
    return [...this.store.values()].map((u) => ({ ...u }));
  }

  async registrarIntentoFallido(
    userId: string,
    params: { intentosFallidos: number; bloqueadoHasta: Date | null }
  ): Promise<void> {
    const usuario = this.buscarPorId(userId);
    if (!usuario) return;

    usuario.intentosFallidos = params.intentosFallidos;
    usuario.bloqueadoHasta = params.bloqueadoHasta;
  }

  async registrarLoginExitoso(userId: string): Promise<void> {
    const usuario = this.buscarPorId(userId);
    if (!usuario) return;

    usuario.intentosFallidos = 0;
    usuario.bloqueadoHasta = null;
  }

  private buscarPorId(userId: string): Usuario | undefined {
    return [...this.store.values()].find((u) => u.id === userId);
  }
}
