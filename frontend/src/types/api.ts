export type EstadoDJ =
  | 'BORRADOR'
  | 'EN_REVISION_FACULTAD'
  | 'APROBADA'
  | 'DEVUELTA'
  | 'EN_REVISION_DPA'
  | 'RECHAZADA';

export type ComandoDJ =
  | 'ENVIAR'
  | 'APROBAR'
  | 'DEVOLVER'
  | 'ESCALAR_DPA'
  | 'REENVIAR'
  | 'RECHAZAR';

export type Rol = 'DOCENTE' | 'ADMIN_FACULTAD' | 'TECNICO_DPA' | 'ADMIN_SISTEMA';

export type ApiErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'INSUFFICIENT_ROLE'
  | 'TOO_MANY_REQUESTS'
  | 'SESSION_EXPIRED'
  | 'INACTIVE_BINDING'
  | 'FORBIDDEN_TRANSITION'
  | 'VALIDATION_ERROR'
  | 'DJ_NOT_FOUND'
  | 'OBSERVATIONS_REQUIRED'
  | 'INVALID_STATE_TRANSITION'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  error: ApiErrorCode | string;
  message?: string;
  correlationId?: string;
  details?: Record<string, string[]>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody
  ) {
    super(body.message ?? body.error);
    this.name = 'ApiError';
  }
}

export interface CreateDjPayload {
  tipo: string;
  periodoAcademico: string;
  camposFormulario: Record<string, unknown>;
}

export interface CreateDjResponse {
  id: string;
  estado: EstadoDJ;
}

export interface DjSummary {
  id: string;
  tipo: string;
  periodoAcademico: string;
  estado: EstadoDJ;
  updatedAt: string;
}

export interface DjHistorialEntry {
  id: string;
  estadoAnterior: EstadoDJ;
  estadoNuevo: EstadoDJ;
  actorId: string;
  observaciones?: string;
  timestamp: string;
}

export interface DjDetail {
  id: string;
  docenteId: string;
  facultadId: string;
  tipo: string;
  periodoAcademico: string;
  estado: EstadoDJ;
  camposFormulario: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  historial: DjHistorialEntry[];
}

export interface TransicionDjResponse {
  id: string;
  estadoAnterior: EstadoDJ;
  estadoNuevo: EstadoDJ;
  historialId: string;
  notificacionEncolada: boolean;
}

export interface ListDjResponse {
  items: DjSummary[];
  total: number;
}

// --- Agente MCP sobre Declaraciones Juradas ---

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

export interface AgenteDJResponse {
  respuesta?: string;
  traza: PasoTraza[];
  confirmacionPendiente?: ConfirmacionPendiente;
  sessionId?: string;
  correlationId?: string;
}
