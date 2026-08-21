import { getSession } from './authStore';
import type {
  ApiErrorBody,
  ComandoDJ,
  CreateDjPayload,
  CreateDjResponse,
  DjDetail,
  ListDjResponse,
  TransicionDjResponse,
} from '../types/api';
import { ApiError } from '../types/api';

const API_BASE = '/api/v1';

/** `dj.routes.ts` ya usa requireRole (JWT real) — nada de headers demo. */
function getAuthHeaders(): HeadersInit {
  const session = getSession();
  return {
    'Content-Type': 'application/json',
    ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...getAuthHeaders(), ...init?.headers },
  });

  const body = (await res.json().catch(() => ({}))) as ApiErrorBody & T;

  if (!res.ok) {
    throw new ApiError(res.status, body);
  }

  return body as T;
}

export async function listDeclaracionesJuradas(params?: {
  estado?: string;
  page?: number;
}): Promise<ListDjResponse> {
  const qs = new URLSearchParams();
  if (params?.estado) qs.set('estado', params.estado);
  if (params?.page) qs.set('page', String(params.page));
  const q = qs.toString();
  return request<ListDjResponse>(`/declaraciones-juradas${q ? `?${q}` : ''}`);
}

export async function createDeclaracionJurada(payload: CreateDjPayload): Promise<CreateDjResponse> {
  return request<CreateDjResponse>('/declaraciones-juradas', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getDeclaracionJurada(id: string): Promise<DjDetail> {
  return request<DjDetail>(`/declaraciones-juradas/${id}`);
}

export async function transicionarDeclaracionJurada(
  id: string,
  comando: ComandoDJ,
  observaciones?: string
): Promise<TransicionDjResponse> {
  return request<TransicionDjResponse>(`/declaraciones-juradas/${id}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ comando, observaciones }),
  });
}

export async function updateDeclaracionJuradaCampos(
  id: string,
  camposFormulario: Record<string, unknown>
): Promise<DjDetail> {
  return request<DjDetail>(`/declaraciones-juradas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ camposFormulario }),
  });
}
