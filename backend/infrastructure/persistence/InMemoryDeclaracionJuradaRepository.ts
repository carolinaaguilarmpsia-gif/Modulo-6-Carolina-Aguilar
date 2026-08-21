import { randomUUID } from 'node:crypto';
import type { DeclaracionJurada } from '../../domain/declaracion-jurada/entities/DeclaracionJurada.js';
import type {
  HistorialDJRecord,
  IDeclaracionJuradaRepository,
  ListarDJResult,
} from '../../domain/declaracion-jurada/ports/out/IDeclaracionJuradaRepository.js';
import type { EstadoDJ } from '../../domain/declaracion-jurada/types/EstadoDJ.js';

/**
 * Repositorio in-memory — demo / desarrollo sin PostgreSQL.
 * @see RB-06 transicionarAtomica atómica
 */
export class InMemoryDeclaracionJuradaRepository implements IDeclaracionJuradaRepository {
  private readonly store = new Map<string, DeclaracionJurada>();
  private readonly historialStore: HistorialDJRecord[] = [];

  /** @param seed DJ precargadas (p. ej. seedDeclaracionesJuradas.ts) — vacío en tests. */
  constructor(seed: DeclaracionJurada[] = []) {
    for (const dj of seed) this.store.set(dj.id, { ...dj });
  }

  async create(dj: DeclaracionJurada): Promise<DeclaracionJurada> {
    this.store.set(dj.id, { ...dj });
    return { ...dj };
  }

  async findById(djId: string): Promise<DeclaracionJurada | null> {
    const dj = this.store.get(djId);
    return dj ? { ...dj } : null;
  }

  async list(params: {
    estado?: EstadoDJ;
    docenteId?: string;
    facultadId?: string;
    page: number;
    pageSize: number;
  }): Promise<ListarDJResult> {
    let items = [...this.store.values()];

    if (params.estado) items = items.filter((d) => d.estado === params.estado);
    if (params.docenteId) items = items.filter((d) => d.docenteId === params.docenteId);
    if (params.facultadId) items = items.filter((d) => d.facultadId === params.facultadId);

    items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const total = items.length;
    const start = (params.page - 1) * params.pageSize;
    items = items.slice(start, start + params.pageSize);

    return { items: items.map((d) => ({ ...d })), total };
  }

  async updateCampos(djId: string, camposFormulario: Record<string, unknown>): Promise<DeclaracionJurada> {
    const dj = this.store.get(djId);
    if (!dj) throw new Error('DJ_NOT_FOUND');

    dj.camposFormulario = { ...camposFormulario };
    dj.updatedAt = new Date();
    this.store.set(djId, dj);
    return { ...dj };
  }

  async transicionarAtomica(params: {
    djId: string;
    estadoNuevo: EstadoDJ;
    actorId: string;
    estadoAnterior: EstadoDJ;
    observaciones?: string;
  }): Promise<HistorialDJRecord> {
    const dj = this.store.get(params.djId);
    if (!dj) throw new Error('DJ_NOT_FOUND');
    if (dj.estado !== params.estadoAnterior) {
      throw new Error('PERSISTENCE_ERROR: estado concurrente modificado');
    }

    const record: HistorialDJRecord = {
      id: randomUUID(),
      djId: params.djId,
      actorId: params.actorId,
      estadoAnterior: params.estadoAnterior,
      estadoNuevo: params.estadoNuevo,
      observaciones: params.observaciones,
      timestamp: new Date(),
    };

    dj.estado = params.estadoNuevo;
    dj.updatedAt = new Date();
    this.store.set(params.djId, dj);
    this.historialStore.push(record);

    return record;
  }

  async getHistorial(djId: string): Promise<HistorialDJRecord[]> {
    return this.historialStore
      .filter((h) => h.djId === djId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map((h) => ({ ...h }));
  }
}
