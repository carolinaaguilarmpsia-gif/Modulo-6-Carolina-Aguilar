import { readFileSync } from 'node:fs';
import type { ITramiteRepository } from '../../domain/tramites-dpa/ports/out/ITramiteRepository.js';
import type { DepartamentoTramites, TramiteConDepartamento } from '../../domain/tramites-dpa/types/Tramite.js';

/**
 * db.json es la fuente de verdad (la "tabla") — se carga en memoria una sola vez al levantar
 * el server. Cada respuesta del asistente puede trazarse a "db.json → departamento X → trámite Y".
 */
export class JsonTramiteRepository implements ITramiteRepository {
  private readonly departamentos: DepartamentoTramites[];
  private readonly indice: Map<string, TramiteConDepartamento>;

  constructor(rutaDbJson: string) {
    const contenido = readFileSync(rutaDbJson, 'utf-8');
    this.departamentos = JSON.parse(contenido) as DepartamentoTramites[];

    this.indice = new Map();
    for (const dep of this.departamentos) {
      for (const t of dep.tramites) {
        this.indice.set(t.codigo, { ...t, departamento: dep.departamento });
      }
    }
  }

  listarDepartamentos(): DepartamentoTramites[] {
    return this.departamentos;
  }

  listarTodos(): TramiteConDepartamento[] {
    return Array.from(this.indice.values());
  }

  buscarPorCodigo(codigo: string): TramiteConDepartamento | undefined {
    return this.indice.get(codigo);
  }
}
