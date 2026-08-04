import { getInactiveBinding, getSession } from './authStore';
import type {
  ApiErrorBody,
  ComandoDJ,
  CreateDjPayload,
  CreateDjResponse,
  DjDetail,
  ListDjResponse,
  Rol,
  TransicionDjResponse,
} from '../types/api';
import { ApiError } from '../types/api';

const API_BASE = '/api/v1';

/**
 * `backend/api/routes/dj.routes.ts` todavía usa `demoAuthMiddleware` (header, no JWT) —
 * la migración a `requireRole` real es trabajo pendiente (ver DD-UC-002 §4). Mientras tanto,
 * derivamos ese header del rol ya autenticado por login real (`POST /auth/login`), en vez de
 * un selector libre, para que el login sea la única fuente de verdad de "quién soy".
 */
const ROL_A_DEMO_HEADER: Partial<Record<Rol, string>> = {
  DOCENTE: 'docente',
  ADMIN_FACULTAD: 'admin_facultad',
  TECNICO_DPA: 'tecnico_dpa',
  // ADMIN_SISTEMA no tiene perfil demo en el backend (no es actor de FSD-UC-002);
  // demoAuthMiddleware cae a "docente" por defecto si el header no matchea un perfil.
};

function getDemoHeaders(): HeadersInit {
  const session = getSession();
  const role = (session && ROL_A_DEMO_HEADER[session.rol]) || 'docente';
  const inactive = getInactiveBinding() ? '1' : '0';
  return {
    'Content-Type': 'application/json',
    'X-SGAI-Demo-User': role,
    'X-SGAI-Demo-Inactive': inactive,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...getDemoHeaders(), ...init?.headers },
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
