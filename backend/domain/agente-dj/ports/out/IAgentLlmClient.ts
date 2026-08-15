import type { AgentLlmTurn, AgentMessage, AgentToolDef } from '../../types/Agente.js';

/**
 * Puerto de salida — turno de conversación con tool-calling real (a diferencia de
 * domain/asistente-ia/ports/out/ILlmClient, que solo hace preguntar(prompt) de un tiro).
 * El dominio no sabe qué proveedor lo implementa (Groq, etc.).
 */
export interface IAgentLlmClient {
  siguienteTurno(mensajes: AgentMessage[], herramientas: AgentToolDef[]): Promise<AgentLlmTurn>;
}
