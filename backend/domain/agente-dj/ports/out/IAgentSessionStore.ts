import type { AgentSessionRecord } from '../../types/Agente.js';

/** Puerto de salida — estado pendiente entre "propone escribir" y "humano confirma". */
export interface IAgentSessionStore {
  guardar(sessionId: string, sesion: AgentSessionRecord): void;
  obtener(sessionId: string): AgentSessionRecord | undefined;
  eliminar(sessionId: string): void;
}
