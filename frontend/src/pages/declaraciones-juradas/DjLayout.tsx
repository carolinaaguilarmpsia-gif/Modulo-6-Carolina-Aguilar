import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function DjLayout() {
  const auth = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    auth.logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-institucional-600">
              SGAI · Declaraciones Juradas
            </p>
            <h1 className="text-lg font-bold text-slate-900">FSD-UC-002</h1>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Navegación DJ">
            <Link
              to="/declaraciones-juradas"
              className="rounded-md px-3 py-1.5 text-slate-700 hover:bg-slate-100"
            >
              {auth.rol === 'DOCENTE' ? 'Mis declaraciones' : 'Bandeja de revisión'}
            </Link>
            {auth.rol === 'DOCENTE' ? (
              <Link
                to="/declaraciones-juradas/nueva"
                className="rounded-md bg-institucional-700 px-3 py-1.5 font-medium text-white hover:bg-institucional-800"
              >
                Nueva DJ
              </Link>
            ) : null}
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-100"
            >
              Cerrar sesión
            </button>
          </nav>
        </div>
        <div className="border-t border-slate-100 bg-slate-100 px-4 py-2">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 text-sm text-slate-700">
            <span>
              Sesión: <strong>{auth.nombreCompleto}</strong> ({auth.label})
            </span>
            {auth.rol === 'DOCENTE' ? (
              <label className="flex items-center gap-2 text-amber-900">
                <input
                  type="checkbox"
                  checked={auth.inactiveBinding}
                  onChange={(e) => auth.setInactiveBinding(e.target.checked)}
                />
                Simular sin vinculación activa (demo RB-01)
              </label>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
