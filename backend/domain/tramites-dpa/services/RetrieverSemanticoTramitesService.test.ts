import type { IEmbeddingsClient } from '../ports/out/IEmbeddingsClient.js';
import type { TramiteConDepartamento } from '../types/Tramite.js';
import { RetrieverSemanticoTramitesService } from './RetrieverSemanticoTramitesService.js';

const TRAMITES: TramiteConDepartamento[] = [
  {
    codigo: 'DPA-01',
    nombre: 'Emisión de Certificado de Trabajo',
    departamento: 'Personal Académico',
    requisitos: ['RECIBO: Para emisión de Certificado de Trabajo.'],
    tiempo: '1 día hábil (24 horas) antes.',
  },
  {
    codigo: 'DCA-01',
    nombre: 'Oferta Académica para inicio de gestión',
    departamento: 'Coordinación Académica',
    normativa: 'Resolución Rectoral N° 750/17',
    requisitos: ['Carta dirigida a Dirección de la DPA'],
    tiempo: 'Una semana previa al inicio de la gestión académica',
  },
];

/**
 * No intenta simular embeddings reales — como FakeAgentLlmClient en otros tests, devuelve un
 * vector fijo por texto conocido para controlar la similitud exactamente. "constancia laboral"
 * (sinónimo sin overlap textual con "Certificado de Trabajo") se arma cerca del vector del
 * chunk de DPA-01 a propósito — así se prueba que la recuperación es semántica, no de substring.
 */
class FakeEmbeddingsClient implements IEmbeddingsClient {
  public llamadas: string[] = [];

  async embed(texto: string): Promise<number[]> {
    this.llamadas.push(texto);
    if (texto.includes('Certificado de Trabajo')) return [1, 0, 0];
    if (texto.includes('constancia laboral')) return [0.9, 0.1, 0];
    if (texto.includes('Oferta Académica')) return [0, 1, 0];
    return [0, 0, 1]; // cualquier otra pregunta: ortogonal a ambos trámites — "no se parece a nada"
  }
}

describe('RetrieverSemanticoTramitesService', () => {
  it('encuentra el trámite correcto por similitud semántica aunque no comparta texto literal', async () => {
    const embeddings = new FakeEmbeddingsClient();
    const service = new RetrieverSemanticoTramitesService(embeddings, TRAMITES);

    const match = await service.buscar('¿Qué necesito para que me den una constancia laboral?');

    expect(match?.codigo).toBe('DPA-01');
    expect(match?.similitud).toBeGreaterThan(0.9);
  });

  it('por debajo del umbral no devuelve nada — nunca fuerza un match que no corresponde', async () => {
    const embeddings = new FakeEmbeddingsClient();
    const service = new RetrieverSemanticoTramitesService(embeddings, TRAMITES);

    const match = await service.buscar('¿Cuánto gana un docente a dedicación exclusiva?');

    expect(match).toBeNull();
  });

  it('cachea el índice: los trámites se embeben una sola vez sin importar cuántas búsquedas se hagan', async () => {
    const embeddings = new FakeEmbeddingsClient();
    const service = new RetrieverSemanticoTramitesService(embeddings, TRAMITES);

    await service.buscar('constancia laboral');
    await service.buscar('constancia laboral de nuevo');

    // 2 trámites embebidos una sola vez (índice) + 2 preguntas embebidas = 4, no 6.
    expect(embeddings.llamadas).toHaveLength(4);
  });
});
