import type { ITramiteRepository } from '../ports/out/ITramiteRepository.js';
import type { FuenteTramite } from '../types/Tramite.js';
import type { DepartamentoListado } from '../types/AsistenteTramites.js';

export interface RequisitosResult {
  requisitos: string[];
  fuente: FuenteTramite;
}

export interface TiempoResult {
  tiempo: string;
  fuente: FuenteTramite;
}

export interface NormativaResult {
  /** null = el trámite existe pero db.json no tiene normativa registrada para él. */
  normativa: string | null;
  fuente: FuenteTramite;
}

/**
 * Las 4 herramientas del asistente. El LLM (o el match de keyword) solo elige CUÁL invocar
 * y con qué código — nunca redacta la respuesta: todo el texto sale de datos reales de db.json.
 */
export class TramiteToolsService {
  constructor(private readonly tramites: ITramiteRepository) {}

  private fuenteDe(codigo: string): FuenteTramite | undefined {
    const t = this.tramites.buscarPorCodigo(codigo);
    if (!t) return undefined;
    return { codigo: t.codigo, nombre: t.nombre, departamento: t.departamento };
  }

  CONSULTAR_REQUISITOS(codigoTramite: string): RequisitosResult | undefined {
    const t = this.tramites.buscarPorCodigo(codigoTramite);
    if (!t) return undefined;
    return { requisitos: t.requisitos, fuente: { codigo: t.codigo, nombre: t.nombre, departamento: t.departamento } };
  }

  CONSULTAR_TIEMPO(codigoTramite: string): TiempoResult | undefined {
    const t = this.tramites.buscarPorCodigo(codigoTramite);
    if (!t) return undefined;
    return { tiempo: t.tiempo, fuente: { codigo: t.codigo, nombre: t.nombre, departamento: t.departamento } };
  }

  CONSULTAR_NORMATIVA(codigoTramite: string): NormativaResult | undefined {
    const t = this.tramites.buscarPorCodigo(codigoTramite);
    if (!t) return undefined;
    return {
      normativa: t.normativa ?? null,
      fuente: { codigo: t.codigo, nombre: t.nombre, departamento: t.departamento },
    };
  }

  LISTAR_TRAMITES(departamento?: string): DepartamentoListado[] {
    const dep = departamento?.trim().toLowerCase();
    return this.tramites
      .listarDepartamentos()
      .filter((d) => !dep || d.departamento.toLowerCase().includes(dep))
      .map((d) => ({
        departamento: d.departamento,
        tramites: d.tramites.map((t) => ({ codigo: t.codigo, nombre: t.nombre })),
      }));
  }
}
