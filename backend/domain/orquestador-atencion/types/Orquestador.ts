/**
 * Intención detectada por el clasificador (nodo 1 del flujo). El LLM SOLO elige entre estos
 * 4 valores — nunca redacta la respuesta final, eso lo hace cada nodo con datos reales.
 * @see ClasificarIntencionService
 */
export enum Intencion {
  CONSULTA_ESTADO_DJ = 'CONSULTA_ESTADO_DJ',
  DUDA_NORMATIVA = 'DUDA_NORMATIVA',
  REPORTAR_PROBLEMA = 'REPORTAR_PROBLEMA',
  OTRO = 'OTRO',
}

/**
 * ABIERTA → normal. ESCALADA → un humano ya tomó el caso, la IA no vuelve a intervenir en esta
 * conversación (regla de NEGOCIO, no técnica) aunque el proceso se reinicie entre medio.
 */
export type EstadoFlujo = 'ABIERTA' | 'ESCALADA';

export interface TurnoConversacion {
  mensaje: string;
  intencion: Intencion;
  /** Qué nodo del flujo resolvió este turno — trazabilidad, mismo criterio que PasoTraza del agente DJ. */
  nodo: string;
  respuesta: string;
  timestamp: string;
}

/** Lo que persiste — sobrevive a un reinicio del proceso (@see JsonConversacionRepository). */
export interface ConversacionEstado {
  conversacionId: string;
  actorUserId: string;
  /** Una vez identificado (propio o buscado por nombre), se reusa en turnos siguientes sin volver a preguntar. */
  docenteId?: string;
  historial: TurnoConversacion[];
  estadoFlujo: EstadoFlujo;
  creadoEn: string;
  actualizadoEn: string;
}

export interface AtenderInput {
  /** Si se omite, arranca una conversación nueva. */
  conversacionId?: string;
  mensaje: string;
}

export interface AtenderResult {
  conversacionId: string;
  respuesta: string;
  intencion: Intencion;
  nodo: string;
  estadoFlujo: EstadoFlujo;
}
