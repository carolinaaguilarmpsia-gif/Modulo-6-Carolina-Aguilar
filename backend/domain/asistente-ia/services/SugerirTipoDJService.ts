import type { ILlmClient } from '../ports/out/ILlmClient.js';

export interface SugerirTipoDJInput {
  tipoDeclarado: string;
  cargoInstitucional: string;
  actividadesDescripcion: string;
}

export interface SugerirTipoDJResult {
  prompt: string;
  respuestaModelo: string;
}

/**
 * "Peldaño 0" de IA en SGAI: primer caso de uso real del modelo, invocado desde el proyecto
 * (no desde un chat web). El prompt se arma con datos reales de una Declaración Jurada.
 * @see docs/baseline/DTI_vFinal.md §9.1 — "Clasificación automática de tipo de DJ" (v2.0, ya anticipado)
 */
export class SugerirTipoDJService {
  constructor(private readonly llm: ILlmClient) {}

  async sugerir(input: SugerirTipoDJInput): Promise<SugerirTipoDJResult> {
    const prompt = this.armarPrompt(input);
    const respuestaModelo = await this.llm.preguntar(prompt);
    return { prompt, respuestaModelo };
  }

  private armarPrompt(input: SugerirTipoDJInput): string {
    return [
      'Sos un asistente que ayuda a validar Declaraciones Juradas (DJ) de una universidad boliviana, bajo normativa CEUB.',
      'Los tipos válidos de DJ son: LABORAL, PATRIMONIAL, INTERESES.',
      '',
      `Cargo institucional del docente: ${input.cargoInstitucional}`,
      `Tipo declarado por el docente: ${input.tipoDeclarado}`,
      `Descripción de actividades que escribió el docente: "${input.actividadesDescripcion}"`,
      '',
      'En una sola frase breve: ¿el tipo declarado es coherente con la descripción? Si no lo es, indicá cuál tipo sería el correcto y por qué.',
    ].join('\n');
  }
}
