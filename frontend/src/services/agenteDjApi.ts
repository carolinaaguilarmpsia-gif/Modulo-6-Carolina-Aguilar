import { getSession } from './authStore';
import type { AgenteDJResponse, ApiErrorBody } from '../types/api';
import { ApiError } from '../types/api';

const API_BASE = '/api/v1';

/** `agenteDj.routes.ts` usa requireRole (JWT real) — mismo criterio que declaracionesJuradasApi. */
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

export async function preguntarAgenteDJ(pregunta: string): Promise<AgenteDJResponse> {
  return request<AgenteDJResponse>('/agente-dj/preguntar', {
    method: 'POST',
    body: JSON.stringify({ pregunta }),
  });
}

export async function confirmarAgenteDJ(sessionId: string, confirmar: boolean): Promise<AgenteDJResponse> {
  return request<AgenteDJResponse>('/agente-dj/confirmar', {
    method: 'POST',
    body: JSON.stringify({ sessionId, confirmar }),
  });
}
