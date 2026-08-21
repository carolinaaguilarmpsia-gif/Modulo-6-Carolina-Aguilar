import { useState } from 'react';
import type { Location } from 'react-router-dom';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FormAlert, FormField, textInputClass } from '../declaraciones-juradas/components/FormAlert';
import { ApiError } from '../../types/api';
import { AsistenteTramitesChat } from './components/AsistenteTramitesChat';

/** @see FSD-UC-001 · DD-UC-002 */
export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (auth.isAuthenticated) {
    const from = (location.state as { from?: Location } | null)?.from?.pathname ?? '/declaraciones-juradas';
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await auth.login(email, password);
      const from = (location.state as { from?: Location } | null)?.from?.pathname ?? '/declaraciones-juradas';
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.message ?? err.body.error);
      } else {
        setError('No se pudo conectar con el servidor. Verifique que el backend esté corriendo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2 md:items-start">
        <div className="w-full">
          <div className="mb-6 text-center md:text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-institucional-600">SGAI</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Iniciar sesión</h1>
            {/* <p className="mt-1 text-sm text-slate-600">FSD-UC-001 · Autenticación y Control de Acceso por Roles</p> */}
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
            aria-busy={loading}
            className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            {error ? (
              <FormAlert variant="error" title="No se pudo iniciar sesión">
                <p>{error}</p>
              </FormAlert>
            ) : null}

            <FormField id="email" label="Correo institucional" required>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={textInputClass()}
                placeholder="docente@universidad.edu.bo"
              />
            </FormField>

            <FormField id="password" label="Contraseña" required>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={textInputClass()}
              />
            </FormField>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-institucional-700 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-institucional-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Verificando…' : 'Iniciar sesión'}
            </button>
          </form>

          {/* <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Cuentas de demostración</p>
            <p className="mt-1">Contraseña para todas: <code className="rounded bg-amber-100 px-1">Demo1234!</code></p>
            <ul className="mt-2 space-y-1">
              {CUENTAS_DEMO.map((c) => (
                <li key={c.email}>
                  <code className="rounded bg-amber-100 px-1">{c.email}</code> — {c.rol}
                </li>
              ))}
            </ul>
          </div> */}
        </div>

        <AsistenteTramitesChat />
      </div>
    </div>
  );
}
