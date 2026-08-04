/**
 * Puerto de salida — verificación de credenciales contra el directorio LDAP/AD institucional.
 * @see DTI vFinal §13.2 — timeout 5s; si no disponible, el dominio hace fallback a IPasswordHasher.
 */
export interface LdapBindResult {
  disponible: boolean;
  autenticado: boolean;
}

export interface ILdapAuthenticator {
  bind(email: string, password: string): Promise<LdapBindResult>;
}
