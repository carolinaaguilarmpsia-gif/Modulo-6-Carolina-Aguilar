import type { ActorContext } from '../../declaracion-jurada/types/CrearDJ.js';

/** Nombre exacto de la herramienta MCP de escritura — dispara el guardrail de confirmación. */
export const HERRAMIENTA_ESCRITURA_DJ = 'transicionar_declaracion_jurada' as const;

/** Un paso del bucle ReAct — la "caja negra" auditable. */
export interface PasoTraza {
  paso: number;
  pensamiento?: string;
  herramienta?: string;
  argumentos?: Record<string, unknown>;
  observacion?: string;
  tokensUsados?: number;
}

export interface ConfirmacionPendiente {
  herramienta: string;
  argumentos: Record<string, unknown>;
  resumen: string;
}

export interface AgenteDJResult {
  respuesta?: string;
  traza: PasoTraza[];
  confirmacionPendiente?: ConfirmacionPendiente;
  sessionId?: string;
}

export type AgentRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AgentToolCall {
  id: string;
  nombre: string;
  argumentos: Record<string, unknown>;
}

export interface AgentMessage {
  role: AgentRole;
  content: string | null;
  /** Solo role:'tool' — vincula la observación con la llamada que la originó. */
  toolCallId?: string;
  /** Solo role:'assistant' cuando el modelo pide herramientas. */
  toolCalls?: AgentToolCall[];
}

export interface AgentToolDef {
  name: string;
  description: string;
  /** JSON Schema — traducido desde el inputSchema real que expone el servidor MCP. */
  parameters: Record<string, unknown>;
}

export interface AgentLlmTurn {
  /** Texto final — presente solo cuando el modelo ya no necesita más herramientas. */
  contenido: string | null;
  llamadasHerramientas: AgentToolCall[];
  tokensUsados: number;
}

/** Estado persistido entre `preguntar()` (pausa en confirmación) y `confirmar()` (resume). */
export interface AgentSessionRecord {
  sessionId: string;
  actorUserId: string;
  actor: ActorContext;
  herramientaPendiente: { nombre: string; argumentos: Record<string, unknown> };
  traza: PasoTraza[];
  creadoEn: Date;
}
