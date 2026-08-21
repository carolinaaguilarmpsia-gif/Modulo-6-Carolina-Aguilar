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

/**
 * Vista previa de la DJ real sobre la que se propone escribir — se arma consultando
 * `consultar_declaracion_jurada` antes de pausar, para que quien confirma vea el contenido
 * (docente, tipo, período, campos) y no solo un id. @see AgenteDJService.construirPreview
 */
export interface DJPreview {
  djId: string;
  docenteId: string;
  facultadId: string;
  tipo: string;
  periodoAcademico: string;
  estadoActual: string;
  /** Estado al que pasaría la DJ si se confirma — ausente si el comando propuesto no es una transición válida desde el estado actual. */
  estadoPropuesto?: string;
  comando: string;
  camposFormulario: Record<string, unknown>;
}

export interface ConfirmacionPendiente {
  herramienta: string;
  argumentos: Record<string, unknown>;
  resumen: string;
  preview?: DJPreview;
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
