import type { Rol } from '../types/api';

export interface AuthSession {
  token: string;
  rol: Rol;
  nombreCompleto: string;
  facultadId: string;
}

type Listener = () => void;

/**
 * Estado de sesión en memoria — MUST NOT persistir el JWT en localStorage/sessionStorage
 * (docs/SKILLS/auth-rbac-guard.md). Se pierde al recargar la página: es la contrapartida
 * aceptada por seguridad; el usuario vuelve a iniciar sesión.
 */
let session: AuthSession | null = null;
let inactiveBinding = false;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function getSession(): AuthSession | null {
  return session;
}

export function setSession(next: AuthSession | null): void {
  session = next;
  emit();
}

export function getInactiveBinding(): boolean {
  return inactiveBinding;
}

export function setInactiveBindingFlag(value: boolean): void {
  inactiveBinding = value;
  emit();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
