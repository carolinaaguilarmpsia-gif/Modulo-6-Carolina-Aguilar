import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { transicionarDeclaracionJurada } from '../../../services/declaracionesJuradasApi';
import type { ComandoDJ, DjDetail, EstadoDJ, Rol } from '../../../types/api';
import { ApiError } from '../../../types/api';
import { FormAlert } from './FormAlert';

interface ActionDef {
  comando: ComandoDJ;
  label: string;
  variant: 'primary' | 'danger' | 'secondary';
  requiresObservaciones?: boolean;
}

function actionsFor(rol: Rol, estado: EstadoDJ): ActionDef[] {
  if (rol === 'DOCENTE') {
    if (estado === 'BORRADOR') return [{ comando: 'ENVIAR', label: 'Enviar a Facultad', variant: 'primary' }];
    if (estado === 'DEVUELTA') return [{ comando: 'REENVIAR', label: 'Reenviar a Facultad', variant: 'primary' }];
  }
  if (rol === 'ADMIN_FACULTAD' && estado === 'EN_REVISION_FACULTAD') {
    return [
      { comando: 'APROBAR', label: 'Aprobar', variant: 'primary' },
      { comando: 'DEVOLVER', label: 'Devolver con observaciones', variant: 'danger', requiresObservaciones: true },
      { comando: 'ESCALAR_DPA', label: 'Escalar al DPA', variant: 'secondary' },
    ];
  }
  if (rol === 'TECNICO_DPA' && estado === 'EN_REVISION_DPA') {
    return [
      { comando: 'APROBAR', label: 'Aprobar (DPA)', variant: 'primary' },
      { comando: 'RECHAZAR', label: 'Rechazar', variant: 'danger', requiresObservaciones: true },
    ];
  }
  return [];
}

interface Props {
  dj: DjDetail;
  onTransition: () => void;
}

export function DJActionPanel({ dj, onTransition }: Props) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [obsComando, setObsComando] = useState<ComandoDJ | null>(null);
  const [observaciones, setObservaciones] = useState('');

  // DJActionPanel solo se renderiza dentro de rutas protegidas por RequireAuth, así que auth.rol
  // siempre está poblado aquí; el fallback es solo para satisfacer el tipo `Rol | null`.
  const actions = auth.rol ? actionsFor(auth.rol, dj.estado) : [];

  const ejecutar = async (comando: ComandoDJ, obs?: string) => {
    setLoading(true);
    setError(null);
    try {
      await transicionarDeclaracionJurada(dj.id, comando, obs);
      onTransition();
      setObsComando(null);
      setObservaciones('');
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.body.message ?? e.body.error);
      } else {
        setError('Error al ejecutar la transición');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (action: ActionDef) => {
    if (action.requiresObservaciones) {
      setObsComando(action.comando);
      return;
    }
    void ejecutar(action.comando);
  };

  if (dj.estado === 'APROBADA' || dj.estado === 'RECHAZADA') {
    return (
      <FormAlert variant="info" title="Trámite cerrado">
        Esta declaración jurada está en estado terminal y no admite más acciones.
      </FormAlert>
    );
  }

  if (actions.length === 0) {
    return (
      <FormAlert variant="info" title="Sin acciones disponibles">
        Como <strong>{auth.label}</strong> no hay transiciones permitidas en estado{' '}
        <strong>{dj.estado}</strong>. Cambie el rol en la barra superior para simular otro actor.
      </FormAlert>
    );
  }

  const btnClass = (v: ActionDef['variant']) => {
    if (v === 'primary') return 'bg-institucional-700 text-white hover:bg-institucional-800';
    if (v === 'danger') return 'bg-red-700 text-white hover:bg-red-800';
    return 'bg-slate-600 text-white hover:bg-slate-700';
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="dj-actions-title">
      <h2 id="dj-actions-title" className="text-lg font-semibold text-slate-900">
        Acciones del trámite
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Actor: {auth.label} · Estado actual registrado en historial atómico (RB-06)
      </p>

      {error ? (
        <div className="mt-4">
          <FormAlert variant="error" title="No se pudo completar la acción">
            <p>{error}</p>
          </FormAlert>
        </div>
      ) : null}

      {obsComando ? (
        <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label htmlFor="obs" className="block text-sm font-medium">
            Observaciones (mínimo 10 caracteres)
          </label>
          <textarea
            id="obs"
            rows={3}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || observaciones.trim().length < 10}
              onClick={() => void ejecutar(obsComando, observaciones.trim())}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => {
                setObsComando(null);
                setObservaciones('');
              }}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((a) => (
            <button
              key={a.comando}
              type="button"
              disabled={loading}
              onClick={() => handleClick(a)}
              className={`rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50 ${btnClass(a.variant)}`}
            >
              {loading ? 'Procesando…' : a.label}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate('/declaraciones-juradas')}
        className="mt-4 text-sm text-institucional-600 underline"
      >
        Volver al listado
      </button>
    </section>
  );
}
