import type { ConversacionEstado } from '../../types/Orquestador.js';

/**
 * Puerto de salida — persistencia del estado del flujo. A diferencia de InMemoryAgentSessionStore
 * (que vive y muere con el proceso), esta SÍ debe sobrevivir un reinicio — es lo que separa un
 * pipeline de una orquestación real (@see JsonConversacionRepository).
 */
export interface IConversacionRepository {
  obtener(conversacionId: string): Promise<ConversacionEstado | null>;
  guardar(estado: ConversacionEstado): Promise<void>;
}
