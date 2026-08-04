import type { EstadoDJ } from '../types/EstadoDJ.js';

/** Agregado DJ — sin dependencias de infraestructura */
export interface DeclaracionJurada {
  id: string;
  docenteId: string;
  facultadId: string;
  estado: EstadoDJ;
  /** RB-01 — debe estar cargado explícitamente (no asumir true) */
  docenteVinculacionActiva: boolean;
  tipo: string;
  periodoAcademico: string;
  camposFormulario: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
