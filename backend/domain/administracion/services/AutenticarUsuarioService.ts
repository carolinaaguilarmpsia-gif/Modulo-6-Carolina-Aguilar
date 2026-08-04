import { ForbiddenError, UnauthorizedError } from '../../shared/errors/DomainError.js';
import type { AutenticarUsuarioUseCase } from '../ports/in/AutenticarUsuarioUseCase.js';
import type { ILdapAuthenticator } from '../ports/out/ILdapAuthenticator.js';
import type { IPasswordHasher } from '../ports/out/IPasswordHasher.js';
import type { IJwtSigner } from '../ports/out/IJwtSigner.js';
import type { IUsuarioRepository } from '../ports/out/IUsuarioRepository.js';
import type { LoginCommand } from '../types/LoginCommand.js';
import type { LoginResult } from '../types/JwtPayload.js';

const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;

/**
 * Orquesta login: LDAP primario + fallback bcrypt local + RB-07 (bloqueo tras 5 intentos).
 * @see FSD-UC-001 · PR-IMPL-003 · DTI vFinal §13.2
 */
export class AutenticarUsuarioService implements AutenticarUsuarioUseCase {
  constructor(
    private readonly usuarios: IUsuarioRepository,
    private readonly ldap: ILdapAuthenticator,
    private readonly hasher: IPasswordHasher,
    private readonly jwt: IJwtSigner
  ) {}

  async autenticar(command: LoginCommand): Promise<LoginResult> {
    const usuario = await this.usuarios.findByEmail(command.email);

    // No revelar si el email existe o no (RB-07 / mensaje genérico)
    if (!usuario) {
      throw new UnauthorizedError('INVALID_CREDENTIALS');
    }

    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta.getTime() > Date.now()) {
      throw new ForbiddenError('ACCOUNT_LOCKED', { bloqueadoHasta: usuario.bloqueadoHasta });
    }

    const autenticado = await this.validarCredenciales(usuario.email, command.password, usuario.passwordHashLocal);

    if (!autenticado) {
      await this.registrarFallo(usuario.id, usuario.intentosFallidos);
      throw new UnauthorizedError('INVALID_CREDENTIALS');
    }

    await this.usuarios.registrarLoginExitoso(usuario.id);

    const token = this.jwt.sign({
      userId: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      facultadId: usuario.facultadId,
    });

    return {
      token,
      rol: usuario.rol,
      nombreCompleto: usuario.nombreCompleto,
      facultadId: usuario.facultadId,
    };
  }

  /** LDAP primario; fallback a bcrypt local si no disponible (DTI §13.2, §7.2 timeout 5s) */
  private async validarCredenciales(email: string, password: string, passwordHashLocal: string): Promise<boolean> {
    const ldapResult = await this.ldap.bind(email, password);

    if (ldapResult.disponible) {
      return ldapResult.autenticado;
    }

    return this.hasher.compare(password, passwordHashLocal);
  }

  private async registrarFallo(userId: string, intentosActuales: number): Promise<void> {
    const intentosFallidos = intentosActuales + 1;
    const bloqueadoHasta =
      intentosFallidos >= MAX_INTENTOS ? new Date(Date.now() + BLOQUEO_MINUTOS * 60_000) : null;

    await this.usuarios.registrarIntentoFallido(userId, { intentosFallidos, bloqueadoHasta });
  }
}
