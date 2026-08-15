import { NotFoundError } from '../../shared/errors/DomainError.js';
import { buscarDocentePorNombre } from '../../administracion/services/BuscarDocentePorNombre.js';
import type { IUsuarioRepository } from '../../administracion/ports/out/IUsuarioRepository.js';
import type { IDeclaracionJuradaRepository } from '../../declaracion-jurada/ports/out/IDeclaracionJuradaRepository.js';
import type { DeclaracionJurada } from '../../declaracion-jurada/entities/DeclaracionJurada.js';
import type { ILlmClient } from '../ports/out/ILlmClient.js';
import type { ConsultaDJInput, ConsultaDJResult } from '../types/ConsultaDJ.js';

interface CamposDJ {
  dependencia?: string;
  cargoInstitucional?: string;
  actividadesDescripcion?: string;
}

/**
 * Busca una Declaración Jurada real a partir de lo que escribe el Administrador de Facultad
 * (nombre de docente + facultad, texto libre) y recién con ese dato real arma el prompt.
 * Nunca inventa una DJ: si no encuentra, 404 (DOCENTE_NOT_FOUND / DJ_NOT_FOUND).
 */
export class ResponderConsultaDJService {
  constructor(
    private readonly usuarios: IUsuarioRepository,
    private readonly declaracionesJuradas: IDeclaracionJuradaRepository,
    private readonly llm: ILlmClient
  ) {}

  async responder(input: ConsultaDJInput): Promise<ConsultaDJResult> {
    const docente = await buscarDocentePorNombre(this.usuarios, input.nombreDocente);
    const dj = await this.buscarDJ(docente.id, input.facultad, input.periodoAcademico);
    const campos = dj.camposFormulario as CamposDJ;

    const djEncontrada = {
      id: dj.id,
      docenteNombre: docente.nombreCompleto,
      facultad: campos.dependencia ?? input.facultad,
      periodoAcademico: dj.periodoAcademico,
      tipo: dj.tipo,
      estado: dj.estado,
      cargoInstitucional: campos.cargoInstitucional ?? '',
      actividadesDescripcion: campos.actividadesDescripcion ?? '',
    };

    const prompt = this.armarPrompt({ ...djEncontrada, consulta: input.consulta });
    const respuestaModelo = await this.llm.preguntar(prompt);

    return { dj: djEncontrada, prompt, respuestaModelo };
  }

  /** Match parcial de facultad contra camposFormulario.dependencia; si no hay período, toma la más reciente. */
  private async buscarDJ(
    docenteId: string,
    facultadConsultada: string,
    periodoAcademico?: string
  ): Promise<DeclaracionJurada> {
    const { items } = await this.declaracionesJuradas.list({ docenteId, page: 1, pageSize: 100 });
    const facultadQuery = facultadConsultada.trim().toLowerCase();

    const candidatas = items.filter((dj) => {
      const campos = dj.camposFormulario as CamposDJ;
      const dependencia = (campos.dependencia ?? '').toLowerCase();
      const coincideFacultad = dependencia.includes(facultadQuery);
      const coincidePeriodo = !periodoAcademico || dj.periodoAcademico === periodoAcademico;
      return coincideFacultad && coincidePeriodo;
    });

    if (candidatas.length === 0) {
      throw new NotFoundError('DJ_NOT_FOUND');
    }

    // items ya viene ordenado por updatedAt desc desde el repositorio — la primera es la más reciente.
    return candidatas[0];
  }

  private armarPrompt(datos: {
    docenteNombre: string;
    facultad: string;
    periodoAcademico: string;
    tipo: string;
    estado: string;
    cargoInstitucional: string;
    actividadesDescripcion: string;
    consulta: string;
  }): string {
    return [
      'Sos un asistente que ayuda al Administrador de Facultad a revisar Declaraciones Juradas (DJ) de una universidad boliviana, bajo normativa CEUB.',
      'Respondé ÚNICAMENTE en base a los datos reales de la Declaración Jurada de abajo. Si la consulta no se puede responder con esos datos, decilo explícitamente en vez de inventar información.',
      '',
      `Docente: ${datos.docenteNombre}`,
      `Facultad: ${datos.facultad}`,
      `Período académico: ${datos.periodoAcademico}`,
      `Tipo declarado: ${datos.tipo}`,
      `Estado actual del trámite: ${datos.estado}`,
      `Cargo institucional: ${datos.cargoInstitucional}`,
      `Descripción de actividades: "${datos.actividadesDescripcion}"`,
      '',
      `Consulta del Administrador de Facultad: "${datos.consulta}"`,
      '',
      'Respondé en un párrafo breve.',
    ].join('\n');
  }
}
