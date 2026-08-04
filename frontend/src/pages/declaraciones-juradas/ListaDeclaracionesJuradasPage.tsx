import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listDeclaracionesJuradas } from '../../services/declaracionesJuradasApi';
import type { DjSummary } from '../../types/api';
import { ApiError } from '../../types/api';
import { DJStateBadge } from './components/DJStateBadge';
import { FormAlert } from './components/FormAlert';

export function ListaDeclaracionesJuradasPage() {
  const [items, setItems] = useState<DjSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDeclaracionesJuradas();
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.body.message ?? 'Error al cargar' : 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Mis declaraciones juradas</h2>
          <p className="text-sm text-slate-600">wireframe_dj_listado.png · FSD §10.1</p>
        </div>
        <Link
          to="/declaraciones-juradas/nueva"
          className="inline-flex justify-center rounded-md bg-institucional-700 px-4 py-2 text-sm font-semibold text-white hover:bg-institucional-800"
        >
          Nueva declaración
        </Link>
      </div>

      {error ? (
        <FormAlert variant="error" title="Error">
          <p>{error}</p>
          <p className="mt-2 text-sm">¿Está corriendo el API? <code>npm run dev:api</code></p>
        </FormAlert>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-600" role="status">
          Cargando listado…
        </p>
      ) : items.length === 0 ? (
        <FormAlert variant="info" title="Sin declaraciones">
          <p>Aún no hay DJs registradas. Cree la primera desde «Nueva declaración».</p>
        </FormAlert>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">
              Listado de declaraciones juradas — {total} registros
            </caption>
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Período
                </th>
                <th scope="col" className="px-4 py-3">
                  Tipo
                </th>
                <th scope="col" className="px-4 py-3">
                  Estado
                </th>
                <th scope="col" className="px-4 py-3">
                  Actualizado
                </th>
                <th scope="col" className="px-4 py-3">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((dj) => (
                <tr key={dj.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{dj.periodoAcademico}</td>
                  <td className="px-4 py-3">{dj.tipo}</td>
                  <td className="px-4 py-3">
                    <DJStateBadge estado={dj.estado} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(dj.updatedAt).toLocaleString('es-BO')}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/declaraciones-juradas/${dj.id}`}
                      className="font-medium text-institucional-700 hover:underline"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
