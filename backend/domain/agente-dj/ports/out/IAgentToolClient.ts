import type { AgentToolDef } from '../../types/Agente.js';

/**
 * Puerto de salida — cliente MCP visto desde el dominio (agnóstico del SDK real).
 * El adaptador de infraestructura habla el protocolo MCP de verdad (tools/list, tools/call);
 * el dominio solo ve "listar herramientas" / "llamar herramienta".
 */
export interface IAgentToolClient {
  listarHerramientas(): Promise<AgentToolDef[]>;
  llamarHerramienta(nombre: string, argumentos: Record<string, unknown>): Promise<{ contenido: string; esError: boolean }>;
  cerrar(): Promise<void>;
}
