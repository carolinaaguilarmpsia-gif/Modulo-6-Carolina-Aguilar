import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { login as loginRequest } from '../services/authApi';
import * as authStore from '../services/authStore';
import type { Rol } from '../types/api';

const ROLE_LABELS: Record<Rol, string> = {
  DOCENTE: 'Docente',
  ADMIN_FACULTAD: 'Admin. Facultad',
  TECNICO_DPA: 'Técnico DPA',
  ADMIN_SISTEMA: 'Admin. Sistema',
};

export interface AuthState {
  isAuthenticated: boolean;
  rol: Rol | null;
  label: string;
  nombreCompleto: string;
  facultadId: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, forceRender] = useState(0);

  useEffect(() => authStore.subscribe(() => forceRender((n) => n + 1)), []);

  const session = authStore.getSession();

  const value: AuthState = {
    isAuthenticated: session !== null,
    rol: session?.rol ?? null,
    label: session ? ROLE_LABELS[session.rol] : '',
    nombreCompleto: session?.nombreCompleto ?? '',
    facultadId: session?.facultadId ?? null,
    login: async (email: string, password: string) => {
      const result = await loginRequest(email, password);
      authStore.setSession(result);
    },
    logout: () => authStore.setSession(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
