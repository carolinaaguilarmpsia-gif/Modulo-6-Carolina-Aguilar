import { jest } from '@jest/globals';
import type { ITramiteRepository } from '../ports/out/ITramiteRepository.js';
import type { ILlmClient } from '../ports/out/ILlmClient.js';
import type { DepartamentoTramites, TramiteConDepartamento } from '../types/Tramite.js';
import { AsistenteTramitesService } from './AsistenteTramitesService.js';

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

  it('el LLM eligiendo un código inexistente en el catálogo también cae al fallback', async () => {
    const llm = new FakeLlmClient('{"tool": "CONSULTAR_REQUISITOS", "codigo": "NO-EXISTE"}');
    const service = new AsistenteTramitesService(new FakeTramiteRepository(), llm, true);

    const resultado = await service.preguntar('pregunta sin keyword que dispare al LLM');

    expect(resultado.camino).toBeNull();
  });
});
