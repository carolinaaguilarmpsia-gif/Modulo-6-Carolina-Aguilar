/** @see DTI vFinal §4.3 · FSD-UC-001 */
export interface LoginCommand {
  email: string;
  password: string;
  ip?: string;
}
