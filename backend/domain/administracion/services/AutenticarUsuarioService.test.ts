import { jest } from '@jest/globals';
import { ForbiddenError, UnauthorizedError } from '../../shared/errors/DomainError.js';
import type { Usuario } from '../entities/Usuario.js';
import type { ILdapAuthenticator, LdapBindResult } from '../ports/out/ILdapAuthenticator.js';
import type { IPasswordHasher } from '../ports/out/IPasswordHasher.js';
import type { IJwtSigner } from '../ports/out/IJwtSigner.js';
import type { IUsuarioRepository } from '../ports/out/IUsuarioRepository.js';
import { Rol } from '../types/Rol.js';
import { AutenticarUsuarioService } from './AutenticarUsuarioService.js';

function crearUsuario(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 'user-1',
    email: 'docente@universidad.edu.bo',
    nombreCompleto: 'Docente Demo',
    passwordHashLocal: 'hash-correcto',
    rol: Rol.DOCENTE,
    facultadId: 'facultad-1',
    vinculacionActiva: true,
    intentosFallidos: 0,
    bloqueadoHasta: null,
    ...overrides,
  };
}

class FakeUsuarioRepository implements IUsuarioRepository {
  constructor(private usuario: Usuario | null) {}
  public llamadasFallo: { intentosFallidos: number; bloqueadoHasta: Date | null }[] = [];
  public loginsExitosos: string[] = [];

  async findByEmail(): Promise<Usuario | null> {
    return this.usuario;
  }
  async registrarIntentoFallido(_userId: string, params: { intentosFallidos: number; bloqueadoHasta: Date | null }): Promise<void> {
    this.llamadasFallo.push(params);
    if (this.usuario) {
      this.usuario = { ...this.usuario, intentosFallidos: params.intentosFallidos, bloqueadoHasta: params.bloqueadoHasta };
    }
  }
  async registrarLoginExitoso(userId: string): Promise<void> {
    this.loginsExitosos.push(userId);
  }
}

class FakeLdap implements ILdapAuthenticator {
  constructor(private result: LdapBindResult) {}
  async bind(): Promise<LdapBindResult> {
    return this.result;
  }
}

class FakeHasher implements IPasswordHasher {
  async hash(plain: string): Promise<string> {
    return `hash-de-${plain}`;
  }
  async compare(plain: string, hash: string): Promise<boolean> {
    return hash === 'hash-correcto' && plain === 'password-correcto';
  }
}

class FakeJwtSigner implements IJwtSigner {
  sign(): string {
    return 'signed-token';
  }
  verify(): never {
    throw new Error('no usado en este test');
  }
}

const LDAP_NO_DISPONIBLE: LdapBindResult = { disponible: false, autenticado: false };

describe('AutenticarUsuarioService', () => {
  it('MUST autenticar con fallback bcrypt cuando LDAP no está disponible', async () => {
    const repo = new FakeUsuarioRepository(crearUsuario());
    const service = new AutenticarUsuarioService(repo, new FakeLdap(LDAP_NO_DISPONIBLE), new FakeHasher(), new FakeJwtSigner());

    const result = await service.autenticar({ email: 'docente@universidad.edu.bo', password: 'password-correcto' });

    expect(result.token).toBe('signed-token');
    expect(result.rol).toBe(Rol.DOCENTE);
    expect(repo.loginsExitosos).toEqual(['user-1']);
  });

  it('MUST usar LDAP cuando está disponible y no llamar al fallback bcrypt', async () => {
    const repo = new FakeUsuarioRepository(crearUsuario());
    const hasher = new FakeHasher();
    const compareSpy = jest.spyOn(hasher, 'compare');
    const service = new AutenticarUsuarioService(
      repo,
      new FakeLdap({ disponible: true, autenticado: true }),
      hasher,
      new FakeJwtSigner()
    );

    const result = await service.autenticar({ email: 'docente@universidad.edu.bo', password: 'cualquier-cosa' });

    expect(result.token).toBe('signed-token');
    expect(compareSpy).not.toHaveBeenCalled();
  });

  it('MUST rechazar con mensaje genérico si el email no existe (RB-07)', async () => {
    const repo = new FakeUsuarioRepository(null);
    const service = new AutenticarUsuarioService(repo, new FakeLdap(LDAP_NO_DISPONIBLE), new FakeHasher(), new FakeJwtSigner());

    await expect(
      service.autenticar({ email: 'no-existe@universidad.edu.bo', password: 'x' })
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', httpStatus: 401 });
  });

  it('MUST incrementar intentosFallidos en password incorrecto', async () => {
    const repo = new FakeUsuarioRepository(crearUsuario({ intentosFallidos: 2 }));
    const service = new AutenticarUsuarioService(repo, new FakeLdap(LDAP_NO_DISPONIBLE), new FakeHasher(), new FakeJwtSigner());

    await expect(service.autenticar({ email: 'docente@universidad.edu.bo', password: 'incorrecta' })).rejects.toBeInstanceOf(
      UnauthorizedError
    );

    expect(repo.llamadasFallo).toEqual([{ intentosFallidos: 3, bloqueadoHasta: null }]);
  });

  it('MUST bloquear la cuenta 15 minutos al 5º intento fallido (RB-07)', async () => {
    const repo = new FakeUsuarioRepository(crearUsuario({ intentosFallidos: 4 }));
    const service = new AutenticarUsuarioService(repo, new FakeLdap(LDAP_NO_DISPONIBLE), new FakeHasher(), new FakeJwtSigner());

    await expect(service.autenticar({ email: 'docente@universidad.edu.bo', password: 'incorrecta' })).rejects.toBeInstanceOf(
      UnauthorizedError
    );

    const [llamada] = repo.llamadasFallo;
    expect(llamada.intentosFallidos).toBe(5);
    expect(llamada.bloqueadoHasta).not.toBeNull();
    expect(llamada.bloqueadoHasta!.getTime()).toBeGreaterThan(Date.now());
  });

  it('MUST rechazar sin validar password si la cuenta ya está bloqueada (RB-07)', async () => {
    const repo = new FakeUsuarioRepository(
      crearUsuario({ bloqueadoHasta: new Date(Date.now() + 10 * 60_000) })
    );
    const hasher = new FakeHasher();
    const compareSpy = jest.spyOn(hasher, 'compare');
    const service = new AutenticarUsuarioService(repo, new FakeLdap(LDAP_NO_DISPONIBLE), hasher, new FakeJwtSigner());

    await expect(
      service.autenticar({ email: 'docente@universidad.edu.bo', password: 'password-correcto' })
    ).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED', httpStatus: 403 });

    expect(compareSpy).not.toHaveBeenCalled();
  });

  it('MUST permitir login tras expirar el bloqueo de 15 minutos', async () => {
    const repo = new FakeUsuarioRepository(
      crearUsuario({ bloqueadoHasta: new Date(Date.now() - 1000) })
    );
    const service = new AutenticarUsuarioService(repo, new FakeLdap(LDAP_NO_DISPONIBLE), new FakeHasher(), new FakeJwtSigner());

    const result = await service.autenticar({ email: 'docente@universidad.edu.bo', password: 'password-correcto' });

    expect(result.token).toBe('signed-token');
  });

  it('MUST ser instancia de ForbiddenError para ACCOUNT_LOCKED', async () => {
    const repo = new FakeUsuarioRepository(crearUsuario({ bloqueadoHasta: new Date(Date.now() + 60_000) }));
    const service = new AutenticarUsuarioService(repo, new FakeLdap(LDAP_NO_DISPONIBLE), new FakeHasher(), new FakeJwtSigner());

    await expect(
      service.autenticar({ email: 'docente@universidad.edu.bo', password: 'x' })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
