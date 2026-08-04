import type { EstadoDJ } from '../../../types/api';

const STYLES: Record<EstadoDJ, string> = {
  BORRADOR: 'bg-slate-100 text-slate-800 ring-slate-300',
  EN_REVISION_FACULTAD: 'bg-amber-100 text-amber-900 ring-amber-300',
  EN_REVISION_DPA: 'bg-blue-100 text-blue-900 ring-blue-300',
  APROBADA: 'bg-emerald-100 text-emerald-900 ring-emerald-300',
  DEVUELTA: 'bg-orange-100 text-orange-900 ring-orange-300',
  RECHAZADA: 'bg-red-100 text-red-900 ring-red-300',
};

const LABELS: Record<EstadoDJ, string> = {
  BORRADOR: 'Borrador',
  EN_REVISION_FACULTAD: 'En revisión — Facultad',
  EN_REVISION_DPA: 'En revisión — DPA',
  APROBADA: 'Aprobada',
  DEVUELTA: 'Devuelta',
  RECHAZADA: 'Rechazada',
};

export function DJStateBadge({ estado }: { estado: EstadoDJ }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STYLES[estado]}`}
    >
      {LABELS[estado]}
    </span>
  );
}
