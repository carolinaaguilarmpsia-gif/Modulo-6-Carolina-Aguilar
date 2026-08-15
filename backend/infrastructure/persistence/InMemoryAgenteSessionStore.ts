import type { IAgentSessionStore } from '../../domain/agente-dj/ports/out/IAgentSessionStore.js';
import type { AgentSessionRecord } from '../../domain/agente-dj/types/Agente.js';

/** Estado pendiente de confirmación — demo/desarrollo, in-memory como el resto de repos de SGAI. */
export class InMemoryAgenteSessionStore implements IAgentSessionStore {
  private readonly store = new Map<string, AgentSessionRecord>();

  guardar(sessionId: string, sesion: AgentSessionRecord): void {
    this.store.set(sessionId, sesion);
  }

  obtener(sessionId: string): AgentSessionRecord | undefined {
    return this.store.get(sessionId);
  }

  eliminar(sessionId: string): void {
    this.store.delete(sessionId);
  }
}
