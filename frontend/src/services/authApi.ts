import { ApiError, type ApiErrorBody, type Rol } from '../types/api';

const API_BASE = '/api/v1';

export interface LoginResponse {
  token: string;
  rol: Rol;
  nombreCompleto: string;
  facultadId: string;
  correlationId?: string;
}

/** @see FSD-UC-001 · DD-UC-002 · POST /api/v1/auth/login */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const body = (await res.json().catch(() => ({}))) as ApiErrorBody & LoginResponse;

  if (!res.ok) {
    throw new ApiError(res.status, body);
  }

  return body;
}
