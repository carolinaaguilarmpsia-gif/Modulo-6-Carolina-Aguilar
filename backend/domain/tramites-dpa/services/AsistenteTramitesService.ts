import type { ITramiteRepository } from '../ports/out/ITramiteRepository.js';
import type { ILlmClient } from '../ports/out/ILlmClient.js';
import type { FuenteTramite, TramiteKeywordEntry } from '../types/Tramite.js';
import type { AsistenteTramitesResult, CaminoRespuesta, NombreHerramienta } from '../types/AsistenteTramites.js';
import { construirCatalogo, encontrarPorKeyword } from './TramiteKeywordCatalog.js';
import { TramiteToolsService } from './TramiteToolsService.js';
import { DecidirHerramientaLlmService } from './DecidirHerramientaLlmService.js';

const RE_TIEMPO = /\b(tiempo|plazo|cu[aá]ndo|con cu[aá]nt[ao]|anticipaci[oó]n|d[ií]as antes)\b/i;
const RE_NORMATIVA = /\b(normativa|resoluci[oó]n|reglamento|marco legal|respalda)\b/i;

function detectarHerramienta(pregunta: string): NombreHerramienta {
  if (RE_TIEMPO.test(pregunta)) return 'CONSULTAR_TIEMPO';
  if (RE_NORMATIVA.test(pregunta)) return 'CONSULTAR_NORMATIVA';
  return 'CONSULTAR_REQUISITOS';
}

interface HerramientaEjecutada {
  texto: string;
  fuente: FuenteTramite;
  herramienta: NombreHerramienta;
}

/**
 * Router de 3 pasos: keyword directo → LLM elige herramienta → fallback "no sé" + LISTAR_TRAMITES.
 * db.json es la única fuente de datos; este servicio nunca deja que el LLM redacte texto libre,
 * solo elige QUÉ herramienta y QUÉ trámite consultar (ver DecidirHerramientaLlmService).
 */
export class AsistenteTramitesService {
  private readonly catalogo: TramiteKeywordEntry[];
  private readonly tools: TramiteToolsService;
  private readonly decisor: DecidirHerramientaLlmService | null;

  constructor(
    private readonly tramites: ITramiteRepository,
    llm: ILlmClient | null,
    private readonly iaHabilitada: boolean
  ) {
    this.catalogo = construirCatalogo(tramites.listarTodos());
    this.tools = new TramiteToolsService(tramites);
    this.decisor = llm ? new DecidirHerramientaLlmService(llm) : null;
  }

  async preguntar(pregunta: string): Promise<AsistenteTramitesResult> {
    const keywordMatch = encontrarPorKeyword(pregunta, this.catalogo);
    if (keywordMatch) {
      const ejecutado = this.ejecutar(detectarHerramienta(pregunta), keywordMatch.codigo);
      if (ejecutado) return this.respuestaConTramite(ejecutado, 'keyword');
    }

    if (this.iaHabilitada && this.decisor) {
      const decision = await this.decisor.decidir(pregunta, this.tramites.listarTodos());
      if (decision.tool !== 'NONE' && decision.codigo) {
        const ejecutado = this.ejecutar(decision.tool, decision.codigo);
        if (ejecutado) return this.respuestaConTramite(ejecutado, 'llm');
      }
    }

    return this.respuestaFueraDeAlcance();
  }

  private ejecutar(tool: NombreHerramienta, codigo: string): HerramientaEjecutada | undefined {
    switch (tool) {
      case 'CONSULTAR_REQUISITOS': {
        const r = this.tools.CONSULTAR_REQUISITOS(codigo);
        if (!r) return undefined;
        const lista = r.requisitos.map((req) => `- ${req}`).join('\n');
        return {
          texto: `Para el trámite **${r.fuente.nombre}** (${r.fuente.codigo} · ${r.fuente.departamento}) necesita:\n${lista}`,
          fuente: r.fuente,
          herramienta: tool,
        };
      }
      case 'CONSULTAR_TIEMPO': {
        const r = this.tools.CONSULTAR_TIEMPO(codigo);
        if (!r) return undefined;
        return {
          texto: `El trámite **${r.fuente.nombre}** (${r.fuente.codigo} · ${r.fuente.departamento}) debe solicitarse con: ${r.tiempo}`,
          fuente: r.fuente,
          herramienta: tool,
        };
      }
      case 'CONSULTAR_NORMATIVA': {
        const r = this.tools.CONSULTAR_NORMATIVA(codigo);
        if (!r) return undefined;
        const texto = r.normativa
          ? `Normativa aplicable a **${r.fuente.nombre}** (${r.fuente.codigo}): ${r.normativa}`
          : `El trámite **${r.fuente.nombre}** (${r.fuente.codigo}) no tiene una normativa registrada en db.json.`;
        return { texto, fuente: r.fuente, herramienta: tool };
      }
      case 'LISTAR_TRAMITES':
        return undefined;
    }
  }

  private respuestaConTramite(ejecutado: HerramientaEjecutada, camino: CaminoRespuesta): AsistenteTramitesResult {
    return {
      respuesta: ejecutado.texto,
      camino,
      herramienta: ejecutado.herramienta,
      fuente: ejecutado.fuente,
      iaHabilitada: this.iaHabilitada,
      fuenteDatos: 'db.json',
    };
  }

  private respuestaFueraDeAlcance(): AsistenteTramitesResult {
    return {
      respuesta:
        'No puedo responder eso — no corresponde a ningún trámite registrado en db.json. Estos son los trámites que sí puedo explicarte:',
      camino: null,
      herramienta: null,
      fuente: null,
      tramitesDisponibles: this.tools.LISTAR_TRAMITES(),
      iaHabilitada: this.iaHabilitada,
      fuenteDatos: 'db.json',
    };
  }

  estado(): { iaHabilitada: boolean; fuenteDatos: 'db.json'; totalTramites: number; departamentos: string[] } {
    const departamentos = this.tramites.listarDepartamentos();
    return {
      iaHabilitada: this.iaHabilitada,
      fuenteDatos: 'db.json',
      totalTramites: this.tramites.listarTodos().length,
      departamentos: departamentos.map((d) => d.departamento),
    };
  }
}
