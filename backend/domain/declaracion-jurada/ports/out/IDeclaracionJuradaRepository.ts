import type { DeclaracionJurada } from '../../entities/DeclaracionJurada.js';
import type { EstadoDJ } from '../../types/EstadoDJ.js';

export interface HistorialDJRecord {
  id: string;
  djId: string;
  actorId: string;
  estadoAnterior: EstadoDJ;
  estadoNuevo: EstadoDJ;
  observaciones?: string;
  timestamp: Date;
}

export interface ListarDJResult {
  items: DeclaracionJurada[];
  total: number;
}

/**
 * Puerto de salida — persistencia DJ.
 * @see RB-06 — implementación MUST usar transacción atómica (estado + historial)
 */
export interface IDeclaracionJuradaRepository {
  create(dj: DeclaracionJurada): Promise<DeclaracionJurada>;
  findById(djId: string): Promise<DeclaracionJurada | null>;
  list(params: { estado?: EstadoDJ; docenteId?: string; facultadId?: string; page: number; pageSize: number }): Promise<ListarDJResult>;
  updateCampos(djId: string, camposFormulario: Record<string, unknown>): Promise<DeclaracionJurada>;
  transicionarAtomica(params: {
    djId: string;
    estadoNuevo: EstadoDJ;
    actorId: string;
    estadoAnterior: EstadoDJ;
    observaciones?: string;
  }): Promise<HistorialDJRecord>;
  getHistorial(djId: string): Promise<HistorialDJRecord[]>;
}
