import type { ILdapAuthenticator, LdapBindResult } from '../../domain/administracion/ports/out/ILdapAuthenticator.js';

/**
 * Stand-in de DESARROLLO — no hay directorio LDAP/AD institucional disponible en este entorno.
 * Siempre reporta "no disponible", forzando el fallback a bcrypt local ya previsto por el DTI §13.2.
 *
 * Reemplazar por `LdapAuthAdapter` (ldapjs) cuando exista acceso al directorio institucional
 * (DTI §5.2). Mismo puerto `ILdapAuthenticator` — el dominio no cambia.
 * @see DD-UC-002 §4
 */
export class LdapUnavailableAuthenticator implements ILdapAuthenticator {
  async bind(_email: string, _password: string): Promise<LdapBindResult> {
    return { disponible: false, autenticado: false };
  }
}
