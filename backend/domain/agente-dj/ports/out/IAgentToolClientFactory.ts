import type { ActorContext } from '../../../declaracion-jurada/types/CrearDJ.js';
import type { IAgentToolClient } from './IAgentToolClient.js';

/**
 * El cliente MCP debe construirse por request, cerrado sobre el actor real autenticado —
 * nunca un singleton compartido, porque el actor determina qué puede ver/hacer cada herramienta
 * (RB-01/RB-06 de DJ) y el LLM jamás debe poder elegir "actuar como" otro rol.
 */
export interface IAgentToolClientFactory {
  crear(actor: ActorContext): Promise<IAgentToolClient>;
}
