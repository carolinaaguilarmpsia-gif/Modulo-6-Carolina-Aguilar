import type { TramiteConDepartamento, TramiteKeywordEntry } from '../types/Tramite.js';

/**
 * Verbos/acciones administrativas genéricas que anteceden al objeto real del trámite en
 * `nombre` (p. ej. "Emisión de Certificado de Trabajo" → el objeto es "Certificado de Trabajo").
 * Quitarlas evita que casi todos los trámites compartan la misma keyword genérica.
 */
const PREFIJOS_GENERICOS = [
  'emisión de',
  'emision de',
  'nombramiento de',
  'designación de',
  'designacion de',
  'designación temporal en',
  'designacion temporal en',
  'creación de',
  'creacion de',
  'supresión de',
  'supresion de',
  'fusión de',
  'fusion de',
  'cambio de',
  'modificación de',
  'modificacion de',
  'registro de',
  'asignación de',
  'asignacion de',
  'rotación de',
  'rotacion de',
  'admisión de',
  'admision de',
  'apertura de',
  'apertura del',
  'certificación para',
  'certificacion para',
  'venta de',
];

/** Conectores por los que se puede partir `nombre` en 2-3 frases más específicas. */
const CONECTORES = /\s+(?:para|durante|que|mediante)\s+/i;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[().,–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrae 2-4 keywords por trámite a partir de su `nombre` — camino "keyword directo"
 * del router de 3 pasos. No usa sinónimos (eso es trabajo del LLM en el paso 2).
 */
export function extraerKeywords(nombre: string): string[] {
  let base = nombre.trim();
  const baseLower = base.toLowerCase();
  const prefijo = PREFIJOS_GENERICOS.find((p) => baseLower.startsWith(p));
  if (prefijo) {
    base = base.slice(prefijo.length).trim();
  }

  // Fragmentos de una sola palabra (p. ej. "Docente", "suplente") quedan afuera: son demasiado
  // genéricos y producirían falsos positivos con preguntas que no son sobre ese trámite.
  const esMultiPalabra = (frase: string) => frase.trim().split(/\s+/).filter(Boolean).length >= 2;

  const partes = base
    .split(CONECTORES)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && esMultiPalabra(p));

  const keywords = partes.length > 0 ? partes : [base];

  return Array.from(new Set(keywords.map(normalizar).filter((k) => esMultiPalabra(k)))).slice(0, 4);
}

export function construirCatalogo(tramites: TramiteConDepartamento[]): TramiteKeywordEntry[] {
  return tramites.map((t) => ({ codigo: t.codigo, keywords: extraerKeywords(t.nombre) }));
}

/**
 * Camino 1 del router: coincidencia directa de keyword (rápido, determinístico).
 * Entre todas las coincidencias, gana la keyword más larga/específica.
 */
export function encontrarPorKeyword(
  pregunta: string,
  catalogo: TramiteKeywordEntry[]
): TramiteKeywordEntry | undefined {
  const preguntaNormalizada = normalizar(pregunta);
  let mejor: { entry: TramiteKeywordEntry; largo: number } | undefined;

  for (const entry of catalogo) {
    for (const keyword of entry.keywords) {
      if (keyword.length >= 4 && preguntaNormalizada.includes(keyword)) {
        if (!mejor || keyword.length > mejor.largo) {
          mejor = { entry, largo: keyword.length };
        }
      }
    }
  }

  return mejor?.entry;
}
