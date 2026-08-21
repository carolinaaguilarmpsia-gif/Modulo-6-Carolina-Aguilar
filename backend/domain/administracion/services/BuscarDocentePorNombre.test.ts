import { NotFoundError, ValidationError } from '../../shared/errors/DomainError.js';
import { Rol } from '../types/Rol.js';
import type { Usuario } from '../entities/Usuario.js';
import type { IUsuarioRepository } from '../ports/out/IUsuarioRepository.js';
import { buscarDocentePorNombre } from './BuscarDocentePorNombre.js';

function usuario(id: string, nombreCompleto: string): Usuario {
  return {
    id,
    email: `${id}@universidad.edu.bo`,
    nombreCompleto,
    passwordHashLocal: 'hash',
    rol: Rol.DOCENTE,
    facultadId: 'facultad-1',
    vinculacionActiva: true,
    intentosFallidos: 0,
    bloqueadoHasta: null,
  };
}

class FakeUsuarioRepository implements IUsuarioRepository {
  constructor(private readonly usuarios: Usuario[]) {}
  async findByEmail(): Promise<Usuario | null> {
    return null;
  }
  async listar(): Promise<Usuario[]> {
    return this.usuarios;
  }
  async registrarIntentoFallido(): Promise<void> {}
  async registrarLoginExitoso(): Promise<void> {}
}

describe('buscarDocentePorNombre', () => {
  const repo = new FakeUsuarioRepository([
    usuario('docente-juan-jaldin', 'Juan Jaldín'),
    usuario('docente-maria-rojas', 'María Rojas'),
    usuario('docente-pedro-fernandez', 'Pedro Fernández'),
  ]);

  it('encuentra por coincidencia parcial insensible a tildes/mayúsculas', async () => {
    const docente = await buscarDocentePorNombre(repo, 'jaldin');
    expect(docente.id).toBe('docente-juan-jaldin');
  });

  it('tira DOCENTE_AMBIGUO con los candidatos cuando hay más de una coincidencia', async () => {
    const repoAmbiguo = new FakeUsuarioRepository([usuario('d1', 'Ana Rojas'), usuario('d2', 'María Rojas')]);
    await expect(buscarDocentePorNombre(repoAmbiguo, 'rojas')).rejects.toMatchObject({
      code: 'DOCENTE_AMBIGUO',
      context: { candidatos: ['Ana Rojas', 'María Rojas'] },
    });
  });

  it('sin coincidencia exacta pero con un nombre parecido, sugiere ese nombre en vez de solo fallar', async () => {
    // "Jaldin" con typo de una letra ("Jaldim") — no matchea por substring, sí por distancia de edición.
    try {
      await buscarDocentePorNombre(repo, 'Juan Jaldim');
      throw new Error('debía tirar NotFoundError');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
      const notFound = err as NotFoundError;
      expect(notFound.code).toBe('DOCENTE_NOT_FOUND');
      expect(notFound.context?.sugerencias).toContain('Juan Jaldín');
    }
  });

  it('sin coincidencia y sin nada parecido, no inventa sugerencias', async () => {
    try {
      await buscarDocentePorNombre(repo, 'Zzzzxxxqqq Wwwwvvv');
      throw new Error('debía tirar NotFoundError');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
      expect((err as NotFoundError).context).toBeUndefined();
    }
  });

  it('nunca deja pasar un ValidationError donde se espera NotFoundError (sanity de tipos de error)', async () => {
    await expect(buscarDocentePorNombre(repo, 'Juan Jaldim')).rejects.not.toBeInstanceOf(ValidationError);
  });
});
