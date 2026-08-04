import bcrypt from 'bcryptjs';
import type { Usuario } from '../../domain/administracion/entities/Usuario.js';
import type { IUsuarioRepository } from '../../domain/administracion/ports/out/IUsuarioRepository.js';
import { Rol } from '../../domain/administracion/types/Rol.js';

const FACULTAD_ID = 'facultad-demo-001';

/** Usuarios semilla de desarrollo — un login por rol. Password de cada uno: `Demo1234!` */
function usuariosSemilla(): Usuario[] {
  const passwordHashDemo = bcrypt.hashSync('Demo1234!', 12);

  return [
    {
      id: 'docente-demo-001',
      email: 'docente@universidad.edu.bo',
      nombreCompleto: 'Docente Demo',
      passwordHashLocal: passwordHashDemo,
      rol: Rol.DOCENTE,
      facultadId: FACULTAD_ID,
      vinculacionActiva: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    },
    {
      id: 'admin-fac-demo-001',
      email: 'admin.facultad@universidad.edu.bo',
      nombreCompleto: 'Admin. Facultad Demo',
      passwordHashLocal: passwordHashDemo,
      rol: Rol.ADMIN_FACULTAD,
      facultadId: FACULTAD_ID,
      vinculacionActiva: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    },
    {
      id: 'dpa-demo-001',
      email: 'dpa@universidad.edu.bo',
      nombreCompleto: 'Técnico DPA Demo',
      passwordHashLocal: passwordHashDemo,
      rol: Rol.TECNICO_DPA,
      facultadId: FACULTAD_ID,
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
      facultadId: FACULTAD_ID,
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
