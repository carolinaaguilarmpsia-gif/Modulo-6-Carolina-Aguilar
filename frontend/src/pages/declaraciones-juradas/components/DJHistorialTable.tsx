import type { DjHistorialEntry } from '../../../types/api';
import { DJStateBadge } from './DJStateBadge';

export function DJHistorialTable({ historial }: { historial: DjHistorialEntry[] }) {
  if (historial.length === 0) {
    return <p className="text-sm text-slate-500">Sin movimientos de estado registrados.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <caption className="sr-only">Historial de cambios de estado</caption>
        <thead className="border-b border-slate-200 text-slate-600">
          <tr>
            <th scope="col" className="py-2 pr-4">
              Fecha
            </th>
            <th scope="col" className="py-2 pr-4">
              De
            </th>
            <th scope="col" className="py-2 pr-4">
              A
            </th>
            <th scope="col" className="py-2">
              Observaciones
            </th>
          </tr>
        </thead>
        <tbody>
          {historial.map((h) => (
            <tr key={h.id} className="border-b border-slate-100">
              <td className="py-2 pr-4 whitespace-nowrap text-slate-600">
                {new Date(h.timestamp).toLocaleString('es-BO')}
              </td>
              <td className="py-2 pr-4">
                <DJStateBadge estado={h.estadoAnterior} />
              </td>
              <td className="py-2 pr-4">
                <DJStateBadge estado={h.estadoNuevo} />
              </td>
              <td className="py-2 text-slate-700">{h.observaciones ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
