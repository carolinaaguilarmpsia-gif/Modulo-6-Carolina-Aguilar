import { jest } from '@jest/globals';
import type { ITramiteRepository } from '../ports/out/ITramiteRepository.js';
import type { ILlmClient } from '../ports/out/ILlmClient.js';
import type { IEmbeddingsClient } from '../ports/out/IEmbeddingsClient.js';
import type { DepartamentoTramites, TramiteConDepartamento } from '../types/Tramite.js';
import { AsistenteTramitesService } from './AsistenteTramitesService.js';
import { RetrieverSemanticoTramitesService } from './RetrieverSemanticoTramitesService.js';

const DEPARTAMENTOS: DepartamentoTramites[] = [
  {
    departamento: 'Personal Académico',
    tramites: [
      {
        codigo: 'DPA-01',
        nombre: 'Emisión de Certificado de Trabajo',
        requisitos: ['RECIBO: Para emisión de Certificado de Trabajo de: Docente, Auxiliar u Otro.'],
        tiempo: '1 día hábil (24 horas) antes.',
      },
    ],
  },
  {
    departamento: 'Coordinación Académica',
    tramites: [
      {
        codigo: 'DCA-01',
        nombre: 'Oferta Académica para inicio de gestión',
        normativa: 'Resolución Rectoral N° 750/17 del 15 de agosto del 2017',
        requisitos: ['Carta dirigida a Dirección de la DPA'],
        tiempo: 'Una semana previa al inicio de la gestión académica',
      },
    ],
  },
];

class FakeTramiteRepository implements ITramiteRepository {
  private readonly indice = new Map<string, TramiteConDepartamento>();

  constructor() {
    for (const dep of DEPARTAMENTOS) {
      for (const t of dep.tramites) {
        this.indice.set(t.codigo, { ...t, departamento: dep.departamento });
      }
    }
  }

  listarDepartamentos(): DepartamentoTramites[] {
    return DEPARTAMENTOS;
  }
  listarTodos(): TramiteConDepartamento[] {
    return Array.from(this.indice.values());
  }
  buscarPorCodigo(codigo: string): TramiteConDepartamento | undefined {
    return this.indice.get(codigo);
  }
}

class FakeLlmClient implements ILlmClient {
  public llamadas = 0;
  constructor(private readonly respuesta: string) {}
  async preguntar(): Promise<string> {
    this.llamadas += 1;
    return this.respuesta;
  }
}

describe('AsistenteTramitesService', () => {
  it('escenario 1 — keyword directo responde con datos reales de db.json sin llamar al LLM', async () => {
    const llm = new FakeLlmClient('no debería llamarse');
    const service = new AsistenteTramitesService(new FakeTramiteRepository(), llm, true);

    const resultado = await service.preguntar('¿Qué requisitos necesito para el certificado de trabajo?');

    expect(resultado.camino).toBe('keyword');
    expect(resultado.herramienta).toBe('CONSULTAR_REQUISITOS');
    expect(resultado.fuente).toEqual({
      codigo: 'DPA-01',
      nombre: 'Emisión de Certificado de Trabajo',
      departamento: 'Personal Académico',
    });
    expect(resultado.respuesta).toContain('RECIBO');
    expect(llm.llamadas).toBe(0);
  });

  it('escenario 2 — sinónimo sin keyword pasa por el LLM y llega al mismo trámite', async () => {
    const llm = new FakeLlmClient('{"tool": "CONSULTAR_REQUISITOS", "codigo": "DPA-01"}');
    const service = new AsistenteTramitesService(new FakeTramiteRepository(), llm, true);

    const resultado = await service.preguntar('¿Qué necesito para que me den una constancia laboral?');

    expect(resultado.camino).toBe('llm');
    expect(resultado.herramienta).toBe('CONSULTAR_REQUISITOS');
    expect(resultado.fuente?.codigo).toBe('DPA-01');
    expect(llm.llamadas).toBe(1);
  });

  it('escenario 3 — fuera de alcance: ninguna herramienta aplica, responde con LISTAR_TRAMITES', async () => {
    const llm = new FakeLlmClient('{"tool": "NONE"}');
    const service = new AsistenteTramitesService(new FakeTramiteRepository(), llm, true);

    const resultado = await service.preguntar('¿Cuánto gana un docente a dedicación exclusiva?');

    expect(resultado.camino).toBeNull();
    expect(resultado.herramienta).toBeNull();
    expect(resultado.fuente).toBeNull();
    expect(resultado.tramitesDisponibles).toBeDefined();
    expect(resultado.tramitesDisponibles?.flatMap((d) => d.tramites)).toEqual(
      expect.arrayContaining([{ codigo: 'DPA-01', nombre: 'Emisión de Certificado de Trabajo' }])
    );
  });

  it('escenario 4 — IA_HABILITADA=false: la misma pregunta del escenario 1 responde igual sin LLM', async () => {
    const service = new AsistenteTramitesService(new FakeTramiteRepository(), null, false);

    const resultado = await service.preguntar('¿Qué requisitos necesito para el certificado de trabajo?');

    expect(resultado.camino).toBe('keyword');
    expect(resultado.iaHabilitada).toBe(false);
    expect(resultado.fuente?.codigo).toBe('DPA-01');
  });

  it('IA_HABILITADA=false y sin keyword: cae directo al fallback, nunca intenta el LLM', async () => {
    const service = new AsistenteTramitesService(new FakeTramiteRepository(), null, false);

    const resultado = await service.preguntar('¿Qué necesito para que me den una constancia laboral?');

    expect(resultado.camino).toBeNull();
    expect(resultado.tramitesDisponibles).toBeDefined();
  });

  it('escenario RAG — un sinónimo sin overlap textual se resuelve por embeddings, sin llegar a llamar al LLM-router', async () => {
    class FakeEmbeddingsClient implements IEmbeddingsClient {
      async embed(texto: string): Promise<number[]> {
        if (texto.includes('Certificado de Trabajo')) return [1, 0, 0];
        if (texto.includes('constancia laboral')) return [0.9, 0.1, 0];
        return [0, 0, 1];
      }
    }
    const llm = new FakeLlmClient('no debería llamarse — el RAG ya lo resolvió antes');
    const repo = new FakeTramiteRepository();
    const retriever = new RetrieverSemanticoTramitesService(new FakeEmbeddingsClient(), repo.listarTodos());
    const service = new AsistenteTramitesService(repo, llm, true, retriever);

    const resultado = await service.preguntar('¿Qué necesito para que me den una constancia laboral?');

    expect(resultado.camino).toBe('rag');
    expect(resultado.fuente?.codigo).toBe('DPA-01');
    expect(resultado.similitud).toBeGreaterThan(0.9);
    expect(llm.llamadas).toBe(0);
  });

  it('RAG por debajo del umbral cede el turno al LLM-router (nunca inventa un trámite)', async () => {
    class FakeEmbeddingsClient implements IEmbeddingsClient {
      async embed(texto: string): Promise<number[]> {
        // Cada trámite (chunk del índice) se embebe en su propio eje; la pregunta va en un
        // tercer eje ortogonal a ambos — ningún trámite se le parece, a propósito.
        if (texto.includes('Certificado de Trabajo')) return [1, 0, 0];
        if (texto.includes('Oferta Académica')) return [0, 1, 0];
        return [0, 0, 1];
      }
    }
    const llm = new FakeLlmClient('{"tool": "CONSULTAR_REQUISITOS", "codigo": "DPA-01"}');
    const repo = new FakeTramiteRepository();
    const retriever = new RetrieverSemanticoTramitesService(new FakeEmbeddingsClient(), repo.listarTodos());
    const service = new AsistenteTramitesService(repo, llm, true, retriever);

    const resultado = await service.preguntar('¿Qué necesito para que me den una constancia laboral?');

    expect(resultado.camino).toBe('llm');
    expect(llm.llamadas).toBe(1);
  });

  it('una pregunta de MONTO (no de procedimiento) nunca pasa por RAG, aunque el embedding matchee alto por overlap de palabras', async () => {
    // Regresión de un caso real medido: "¿Cuánto gana...a dedicación exclusiva?" recupera por
    // similitud coseno el trámite "...Dedicación Exclusiva" con score alto porque comparten
    // texto, aunque la pregunta no sea sobre el trámite. Este Fake simula justamente eso —
    // si el guard temático fallara, este test lo detectaría.
    class FakeEmbeddingsClientQueMatcheaMal implements IEmbeddingsClient {
      async embed(): Promise<number[]> {
        return [1, 0, 0]; // "matchea" con todo — si el guard no corta antes, este test falla
      }
    }
    const llm = new FakeLlmClient('{"tool": "NONE"}');
    const repo = new FakeTramiteRepository();
    const retriever = new RetrieverSemanticoTramitesService(new FakeEmbeddingsClientQueMatcheaMal(), repo.listarTodos());
    const service = new AsistenteTramitesService(repo, llm, true, retriever);

    const resultado = await service.preguntar('¿Cuánto gana un docente a dedicación exclusiva?');

    expect(resultado.camino).toBeNull();
    expect(resultado.tramitesDisponibles).toBeDefined();
  });

  it('el LLM eligiendo un código inexistente en el catálogo también cae al fallback', async () => {
    const llm = new FakeLlmClient('{"tool": "CONSULTAR_REQUISITOS", "codigo": "NO-EXISTE"}');
    const service = new AsistenteTramitesService(new FakeTramiteRepository(), llm, true);

    const resultado = await service.preguntar('pregunta sin keyword que dispare al LLM');

    expect(resultado.camino).toBeNull();
  });
});
