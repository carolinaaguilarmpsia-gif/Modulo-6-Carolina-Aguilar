import type { ILlmClient } from '../ports/out/ILlmClient.js';
import type { TramiteConDepartamento } from '../types/Tramite.js';
import type { NombreHerramienta } from '../types/AsistenteTramites.js';

export interface DecisionHerramienta {
  tool: NombreHerramienta | 'NONE';
  codigo?: string;
}

const HERRAMIENTAS_CONSULTA: ReadonlySet<string> = new Set([
  'CONSULTAR_REQUISITOS',
  'CONSULTAR_TIEMPO',
  'CONSULTAR_NORMATIVA',
]);

/**
 * Camino 2 del router: "el LLM elige la herramienta + el código de trámite, nunca redacta
 * la respuesta él mismo". Si el modelo no responde JSON válido, o elige un trámite/herramienta
 * que no existe en el catálogo, se degrada a NONE — el router pasa al fallback (paso 3), nunca
 * inventa una respuesta.
 */
export class DecidirHerramientaLlmService {
  constructor(private readonly llm: ILlmClient) {}

  async decidir(pregunta: string, catalogo: TramiteConDepartamento[]): Promise<DecisionHerramienta> {
    const prompt = this.armarPrompt(pregunta, catalogo);

    let texto: string;
    try {
      texto = await this.llm.preguntar(prompt);
    } catch {
      return { tool: 'NONE' };
    }

    const decision = this.parsear(texto);
    if (!decision || decision.tool === 'NONE') return { tool: 'NONE' };
    if (!decision.codigo || !catalogo.some((t) => t.codigo === decision.codigo)) return { tool: 'NONE' };

    return decision;
  }

  private armarPrompt(pregunta: string, catalogo: TramiteConDepartamento[]): string {
    const listado = catalogo.map((t) => `${t.codigo} — ${t.nombre} — ${t.departamento}`).join('\n');

    return [
      'Sos un router que decide qué herramienta usar para responder preguntas sobre TRÁMITES',
      '(procedimientos administrativos: qué documentos presentar, con cuánta anticipación, o qué',
      'normativa los respalda) de la Dirección de Personal Académico (DPA) de una universidad',
      'boliviana. No redactás la respuesta final: solo elegís la herramienta y el código de trámite',
      'exacto del catálogo.',
      '',
      'Herramientas disponibles:',
      '- CONSULTAR_REQUISITOS: qué documentos o requisitos necesita el trámite',
      '- CONSULTAR_TIEMPO: con cuánta anticipación debe solicitarse',
      '- CONSULTAR_NORMATIVA: qué normativa o resolución respalda el trámite',
      '',
      'IMPORTANTE: el nombre de un trámite puede compartir palabras con la pregunta sin que la',
      'pregunta sea realmente sobre ese trámite. Un trámite es un PROCEDIMIENTO (presentar papeles,',
      'pedir una designación, etc.), no un tema en general. Preguntas sobre montos de sueldo,',
      'remuneraciones, opiniones, o cualquier cosa que no sea "qué necesito/cuándo/qué normativa para',
      'tramitar X" deben responder NONE aunque mencionen palabras parecidas a un nombre de trámite.',
      '',
      'Ejemplo: "¿Cuánto gana un docente a dedicación exclusiva?" es una pregunta sobre un monto de',
      'sueldo, no sobre cómo tramitar el nombramiento → {"tool": "NONE"}',
      '',
      'Catálogo de trámites (código — nombre — departamento):',
      listado,
      '',
      `Pregunta del usuario: "${pregunta}"`,
      '',
      'Respondé ÚNICAMENTE un JSON, sin texto adicional ni explicación, con este formato exacto:',
      '{"tool": "NOMBRE_HERRAMIENTA", "codigo": "CODIGO_TRAMITE"}',
      '',
      'Si ninguna herramienta o ningún trámite del catálogo corresponde a la pregunta, respondé',
      'exactamente: {"tool": "NONE"}',
    ].join('\n');
  }

  private parsear(texto: string): DecisionHerramienta | null {
    const match = texto.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      const obj = JSON.parse(match[0]) as { tool?: unknown; codigo?: unknown };
      if (obj.tool === 'NONE') return { tool: 'NONE' };
      if (typeof obj.tool === 'string' && HERRAMIENTAS_CONSULTA.has(obj.tool) && typeof obj.codigo === 'string') {
        return { tool: obj.tool as NombreHerramienta, codigo: obj.codigo };
      }
      return null;
    } catch {
      return null;
    }
  }
}
