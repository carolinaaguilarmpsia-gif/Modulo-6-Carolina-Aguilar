import type { LoginCommand } from '../../types/LoginCommand.js';
import type { LoginResult } from '../../types/JwtPayload.js';

/** Puerto de entrada — DTI vFinal §5.1. @see FSD-UC-001 */
export interface AutenticarUsuarioUseCase {
  autenticar(command: LoginCommand): Promise<LoginResult>;
}
