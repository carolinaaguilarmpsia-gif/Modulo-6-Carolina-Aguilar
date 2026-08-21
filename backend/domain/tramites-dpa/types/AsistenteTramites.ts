import type { FuenteTramite } from './Tramite.js';

/** Cómo se resolvió la pregunta — visible en el chat como etiqueta de transparencia. */
export type CaminoRespuesta = 'keyword' | 'rag' | 'llm';

export type NombreHerramienta =
  | 'CONSULTAR_REQUISITOS'
  | 'CONSULTAR_TIEMPO'
  | 'CONSULTAR_NORMATIVA'
  | 'LISTAR_TRAMITES';

export interface DepartamentoListado {
  departamento: string;
  tramites: { codigo: string; nombre: string }[];
}

export interface AsistenteTramitesResult {
  respuesta: string;
  /** null cuando la pregunta está fuera de alcance (ningún trámite de db.json aplica). */
  camino: CaminoRespuesta | null;
  /** Qué herramienta de las 4 se ejecutó; null si es fuera de alcance (ninguna aplicó). */
  herramienta: NombreHerramienta | null;
  /** Trámite + departamento de db.json que originó la respuesta; null si es fuera de alcance. */
  fuente: FuenteTramite | null;
  /** Solo cuando camino === 'rag' — similitud coseno (0-1) entre la pregunta y el trámite recuperado. */
  similitud?: number;
  /** Solo presente en el escenario "fuera de alcance" — el "no sé, pero esto sí". */
  tramitesDisponibles?: DepartamentoListado[];
  iaHabilitada: boolean;
  fuenteDatos: 'db.json';
}

export interface EstadoAsistenteTramites {
  iaHabilitada: boolean;
  fuenteDatos: 'db.json';
  totalTramites: number;
  departamentos: string[];
}
