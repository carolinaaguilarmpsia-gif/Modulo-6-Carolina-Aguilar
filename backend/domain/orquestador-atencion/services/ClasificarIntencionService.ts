import type { ILlmClient } from '../ports/out/ILlmClient.js';
import { Intencion } from '../types/Orquestador.js';

const INTENCIONES_VALIDAS: ReadonlySet<string> = new Set(Object.values(Intencion));

export interface ClasificacionResultado {
  intencion: Intencion;
  /** Solo cuando la intención es CONSULTA_ESTADO_DJ y el mensaje nombra a un docente puntual — el LLM lo extrae en la misma llamada, nunca se asume que "el mensaje entero" es un nombre. */
  docente?: string;
}

/**
 * Nodo 1 del flujo — el LLM SOLO clasifica (y, si aplica, extrae un nombre), nunca redacta la
 * respuesta final. Mismo patrón que DecidirHerramientaLlmService (tramites-dpa): fuerza un JSON
 * de un vocabulario cerrado y degrada a un valor seguro (OTRO) si el modelo falla, manda texto
 * libre, o inventa una categoría que no existe — el resto del flujo nunca ve una intención inválida.
 */
export class ClasificarIntencionService {
  constructor(private readonly llm: ILlmClient) {}

  async clasificar(mensaje: string): Promise<ClasificacionResultado> {
    let texto: string;
    try {
      texto = await this.llm.preguntar(this.armarPrompt(mensaje));
    } catch {
      return { intencion: Intencion.OTRO };
    }
    return this.parsear(texto);
  }

  private armarPrompt(mensaje: string): string {
    return [
      'Sos un clasificador de intención para el chat de atención de una universidad boliviana',
      '(consultas de docentes y administrativos sobre Declaraciones Juradas y trámites de la DPA).',
      'No respondés la consulta: solo elegís UNA categoría y, si aplica, extraés un nombre.',
      '',
      'Categorías:',
      '- CONSULTA_ESTADO_DJ: quiere saber en qué estado está una Declaración Jurada puntual (suya o de otro docente).',
      '- DUDA_NORMATIVA: pregunta por requisitos, plazos o normativa de un trámite en general (no de una DJ puntual).',
      '- REPORTAR_PROBLEMA: algo salió mal, hay un reclamo, un caso especial, o pide explícitamente hablar con una persona.',
      '- OTRO: cualquier otra cosa (saludo, pregunta ambigua, tema no relacionado).',
      '',
      'Si la intención es CONSULTA_ESTADO_DJ y el mensaje menciona el nombre de un docente puntual',
      '(no "yo", "mi declaración", etc. — un nombre real), extraelo tal cual aparece en "docente".',
      'Si no menciona ningún nombre, omitilo o poné null — nunca inventes un nombre ni copies el mensaje entero.',
      '',
      `Mensaje: "${mensaje}"`,
      '',
      'Respondé ÚNICAMENTE un JSON, sin texto adicional, con este formato exacto:',
      '{"intencion": "CONSULTA_ESTADO_DJ" | "DUDA_NORMATIVA" | "REPORTAR_PROBLEMA" | "OTRO", "docente": "nombre o null"}',
    ].join('\n');
  }

  private parsear(texto: string): ClasificacionResultado {
    const match = texto.match(/\{[\s\S]*\}/);
    if (!match) return { intencion: Intencion.OTRO };

    try {
      const obj = JSON.parse(match[0]) as { intencion?: unknown; docente?: unknown };
      const valor = typeof obj.intencion === 'string' ? obj.intencion : '';
      const intencion = INTENCIONES_VALIDAS.has(valor) ? (valor as Intencion) : Intencion.OTRO;
      const docente = typeof obj.docente === 'string' && obj.docente.trim().length > 0 ? obj.docente.trim() : undefined;
      return { intencion, docente };
    } catch {
      return { intencion: Intencion.OTRO };
    }
  }
}
