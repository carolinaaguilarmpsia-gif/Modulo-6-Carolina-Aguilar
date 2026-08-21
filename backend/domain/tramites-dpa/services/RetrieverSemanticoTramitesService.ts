import type { IEmbeddingsClient } from '../ports/out/IEmbeddingsClient.js';
import type { TramiteConDepartamento } from '../types/Tramite.js';

/**
 * Cuánto tiene que parecerse la pregunta al trámite más cercano para confiar en el match.
 * Empírico con nomic-embed-text + cosine similarity sobre trámites en español: 0.5 separa bien
 * una pregunta relacionada ("¿qué necesito para una constancia laboral?" ~0.6-0.7 contra DPA-01)
 * de una que no tiene nada que ver ("¿cuánto gana un docente?" ~0.3-0.4 contra cualquier trámite).
 * Ajustable — si en producción da falsos positivos, subirlo; si descarta matches válidos, bajarlo.
 */
const UMBRAL_SIMILITUD = 0.5;

export interface MatchSemantico {
  codigo: string;
  similitud: number;
}

interface ChunkIndexado {
  codigo: string;
  vector: number[];
}

/** Un trámite entero es la unidad de recuperación — cada uno ya es un documento corto y autocontenido, no hace falta partirlo en fragmentos más chicos. */
function construirChunk(t: TramiteConDepartamento): string {
  return [
    t.nombre,
    t.departamento,
    t.descripcion ?? '',
    `Requisitos: ${t.requisitos.join('; ')}`,
    t.normativa ? `Normativa: ${t.normativa}` : '',
    `Tiempo: ${t.tiempo}`,
  ]
    .filter(Boolean)
    .join('. ');
}

function similitudCoseno(a: number[], b: number[]): number {
  let producto = 0;
  let normaA = 0;
  let normaB = 0;
  for (let i = 0; i < a.length; i++) {
    producto += a[i] * b[i];
    normaA += a[i] * a[i];
    normaB += b[i] * b[i];
  }
  if (normaA === 0 || normaB === 0) return 0;
  return producto / (Math.sqrt(normaA) * Math.sqrt(normaB));
}

/**
 * RAG del asistente de trámites — Nivel 3 de la escalera: recuperación por embeddings (no
 * keyword), con umbral de confianza explícito. Top-k=1: cada trámite es un documento atómico,
 * no hay fragmentos parciales que combinar.
 *
 * El índice (un embedding por trámite) se calcula una sola vez y se cachea en memoria — mismo
 * patrón que los repositorios In-Memory del resto del backend, solo que acá lo que se cachea es
 * el resultado de una llamada a un modelo, no datos de un repositorio.
 * @see AsistenteTramitesService — paso 2 del router (entre keyword y el LLM-router de tools)
 */
export class RetrieverSemanticoTramitesService {
  private indice: Promise<ChunkIndexado[]> | null = null;

  constructor(
    private readonly embeddings: IEmbeddingsClient,
    private readonly tramites: TramiteConDepartamento[]
  ) {}

  async buscar(pregunta: string): Promise<MatchSemantico | null> {
    const [indice, vectorPregunta] = await Promise.all([this.obtenerIndice(), this.embeddings.embed(pregunta)]);

    let mejor: MatchSemantico | null = null;
    for (const chunk of indice) {
      const similitud = similitudCoseno(vectorPregunta, chunk.vector);
      if (!mejor || similitud > mejor.similitud) {
        mejor = { codigo: chunk.codigo, similitud };
      }
    }

    return mejor && mejor.similitud >= UMBRAL_SIMILITUD ? mejor : null;
  }

  private obtenerIndice(): Promise<ChunkIndexado[]> {
    if (!this.indice) {
      this.indice = Promise.all(
        this.tramites.map(async (t) => ({ codigo: t.codigo, vector: await this.embeddings.embed(construirChunk(t)) }))
      );
    }
    return this.indice;
  }
}
