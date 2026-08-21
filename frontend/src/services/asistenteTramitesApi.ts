import { ApiError, type ApiErrorBody } from '../types/api';

const API_BASE = '/api/v1/asistente-tramites';

export type CaminoRespuesta = 'keyword' | 'rag' | 'llm';

export type NombreHerramienta =
  | 'CONSULTAR_REQUISITOS'
  | 'CONSULTAR_TIEMPO'
  | 'CONSULTAR_NORMATIVA'
  | 'LISTAR_TRAMITES';

export interface FuenteTramite {
  codigo: string;
  nombre: string;
  departamento: string;
}

export interface DepartamentoListado {
  departamento: string;
  tramites: { codigo: string; nombre: string }[];
}

export interface AsistenteTramitesResponse {
  respuesta: string;
  camino: CaminoRespuesta | null;
  herramienta: NombreHerramienta | null;
  fuente: FuenteTramite | null;
  /** Solo cuando camino === 'rag' — similitud coseno (0-1) entre la pregunta y el trámite recuperado por embeddings. */
  similitud?: number;
  tramitesDisponibles?: DepartamentoListado[];
  iaHabilitada: boolean;
  fuenteDatos: 'db.json';
  correlationId?: string;
}

export interface EstadoAsistenteTramites {
  iaHabilitada: boolean;
  fuenteDatos: 'db.json';
  totalTramites: number;
  departamentos: string[];
  correlationId?: string;
}

/** Endpoint público (sin login) — asistente de trámites DPA en la pantalla de login. */
export async function preguntarAsistenteTramites(pregunta: string): Promise<AsistenteTramitesResponse> {
  const res = await fetch(`${API_BASE}/preguntar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pregunta }),
  });

  const body = (await res.json().catch(() => ({}))) as ApiErrorBody & AsistenteTramitesResponse;

  if (!res.ok) {
    throw new ApiError(res.status, body);
  }

  return body;
}

export async function obtenerEstadoAsistenteTramites(): Promise<EstadoAsistenteTramites> {
  const res = await fetch(`${API_BASE}/estado`);
  const body = (await res.json().catch(() => ({}))) as ApiErrorBody & EstadoAsistenteTramites;

  if (!res.ok) {
    throw new ApiError(res.status, body);
  }

  return body;
}
