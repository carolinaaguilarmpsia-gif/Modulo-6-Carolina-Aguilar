import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getDeclaracionJurada } from '../../services/declaracionesJuradasApi';
import type { DjDetail } from '../../types/api';
import { ApiError } from '../../types/api';
import { DJActionPanel } from './components/DJActionPanel';
import { DJHistorialTable } from './components/DJHistorialTable';
import { DJStateBadge } from './components/DJStateBadge';
import { FormAlert } from './components/FormAlert';

export function DetalleDeclaracionJuradaPage() {
  const { id } = useParams<{ id: string }>();
  const [dj, setDj] = useState<DjDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getDeclaracionJurada(id);
      setDj(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.body.message ?? 'No encontrada' : 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <p className="text-sm text-slate-600" role="status">
        Cargando declaración jurada…
      </p>
    );
  }

  if (error || !dj) {
    return (
      <FormAlert variant="error" title="Error">
        <p>{error ?? 'DJ no encontrada'}</p>
        <Link to="/declaraciones-juradas" className="mt-2 inline-block text-sm underline">
          Volver al listado
        </Link>
      </FormAlert>
    );
  }

  const campos = dj.camposFormulario;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to="/declaraciones-juradas" className="text-sm text-institucional-600 hover:underline">
            ← Listado
          </Link>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Declaración Jurada</h2>
          <p className="mt-1 font-mono text-xs text-slate-500">{dj.id}</p>
        </div>
        <DJStateBadge estado={dj.estado} />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-slate-900">Datos del trámite</h3>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-slate-500">Tipo</dt>
            <dd className="font-medium">{dj.tipo}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Período académico</dt>
            <dd className="font-medium">{dj.periodoAcademico}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Creada</dt>
            <dd>{new Date(dj.createdAt).toLocaleString('es-BO')}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Última actualización</dt>
            <dd>{new Date(dj.updatedAt).toLocaleString('es-BO')}</dd>
          </div>
        </dl>

        <h4 className="mt-6 font-medium text-slate-800">Campos del formulario</h4>
        <ul className="mt-2 space-y-2 text-sm">
          {Object.entries(campos).map(([k, v]) => (
            <li key={k} className="rounded bg-slate-50 px-3 py-2">
              <span className="font-medium text-slate-600">{k}: </span>
              <span>{typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v)}</span>
            </li>
          ))}
        </ul>
      </section>

      <DJActionPanel dj={dj} onTransition={() => void load()} />

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-slate-900">Historial de auditoría (RB-06)</h3>
        <div className="mt-4">
          <DJHistorialTable historial={dj.historial} />
        </div>
      </section>
    </div>
  );
}
