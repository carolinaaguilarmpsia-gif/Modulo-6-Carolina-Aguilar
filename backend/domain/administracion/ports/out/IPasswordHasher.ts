/** Puerto de salida — hashing de contraseñas (fallback local, DTI §13.2). Cost factor >= 12. */
export interface IPasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}
