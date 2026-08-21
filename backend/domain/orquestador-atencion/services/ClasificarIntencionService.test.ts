import type { ILlmClient } from '../ports/out/ILlmClient.js';
import { Intencion } from '../types/Orquestador.js';
import { ClasificarIntencionService } from './ClasificarIntencionService.js';

class FakeLlmClient implements ILlmClient {
  constructor(private readonly respuesta: string | (() => Promise<string>)) {}
  async preguntar(): Promise<string> {
    if (typeof this.respuesta === 'string') return this.respuesta;
    return this.respuesta();
  }
}

describe('ClasificarIntencionService', () => {
  it('parsea una intención válida del JSON del modelo', async () => {
    const service = new ClasificarIntencionService(new FakeLlmClient('{"intencion": "CONSULTA_ESTADO_DJ"}'));
    expect(await service.clasificar('¿en qué va mi declaración?')).toEqual({ intencion: Intencion.CONSULTA_ESTADO_DJ });
  });

  it('extrae el nombre del docente cuando el mensaje lo menciona — nunca copia el mensaje entero', async () => {
    const service = new ClasificarIntencionService(
      new FakeLlmClient('{"intencion": "CONSULTA_ESTADO_DJ", "docente": "María Rojas"}')
    );
    const resultado = await service.clasificar('¿cómo va la declaración de María Rojas?');
    expect(resultado).toEqual({ intencion: Intencion.CONSULTA_ESTADO_DJ, docente: 'María Rojas' });
  });

  it('sin nombre mencionado, "docente" queda ausente (no lo inventa)', async () => {
    const service = new ClasificarIntencionService(new FakeLlmClient('{"intencion": "CONSULTA_ESTADO_DJ", "docente": null}'));
    const resultado = await service.clasificar('¿en qué va mi declaración?');
    expect(resultado.docente).toBeUndefined();
  });

  it('tolera texto alrededor del JSON (el modelo a veces agrega explicación)', async () => {
    const service = new ClasificarIntencionService(
      new FakeLlmClient('Claro, acá va:\n{"intencion": "DUDA_NORMATIVA"}\nespero que ayude')
    );
    expect(await service.clasificar('¿qué normativa respalda esto?')).toEqual({ intencion: Intencion.DUDA_NORMATIVA });
  });

  it('una categoría inventada (fuera del vocabulario cerrado) degrada a OTRO', async () => {
    const service = new ClasificarIntencionService(new FakeLlmClient('{"intencion": "QUEJA_FORMAL"}'));
    expect(await service.clasificar('cualquier cosa')).toEqual({ intencion: Intencion.OTRO });
  });

  it('una respuesta sin JSON parseable degrada a OTRO', async () => {
    const service = new ClasificarIntencionService(new FakeLlmClient('no puedo ayudarte con eso'));
    expect(await service.clasificar('cualquier cosa')).toEqual({ intencion: Intencion.OTRO });
  });

  it('si el LLM falla (rate limit, timeout, etc.) degrada a OTRO, nunca revienta el flujo', async () => {
    const service = new ClasificarIntencionService(
      new FakeLlmClient(() => {
        throw new Error('LLM_REQUEST_FAILED');
      })
    );
    expect(await service.clasificar('cualquier cosa')).toEqual({ intencion: Intencion.OTRO });
  });
});
