import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ConversacionEstado } from '../../domain/orquestador-atencion/types/Orquestador.js';
import { Intencion } from '../../domain/orquestador-atencion/types/Orquestador.js';
import { JsonConversacionRepository } from './JsonConversacionRepository.js';

function estadoDePrueba(id: string): ConversacionEstado {
  const ahora = new Date().toISOString();
  return {
    conversacionId: id,
    actorUserId: 'docente-1',
    docenteId: 'docente-1',
    historial: [{ mensaje: 'hola', intencion: Intencion.OTRO, nodo: 'pedir_aclaracion', respuesta: '¿en qué te ayudo?', timestamp: ahora }],
    estadoFlujo: 'ABIERTA',
    creadoEn: ahora,
    actualizadoEn: ahora,
  };
}

describe('JsonConversacionRepository', () => {
  let dir: string;
  let archivo: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sgai-conversaciones-'));
    archivo = join(dir, 'conversaciones.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('el archivo no existe todavía — obtener() no revienta, devuelve null', async () => {
    const repo = new JsonConversacionRepository(archivo);
    expect(await repo.obtener('no-existe')).toBeNull();
  });

  it('guarda y recupera un estado dentro de la misma instancia', async () => {
    const repo = new JsonConversacionRepository(archivo);
    await repo.guardar(estadoDePrueba('conv-1'));

    const recuperado = await repo.obtener('conv-1');
    expect(recuperado?.docenteId).toBe('docente-1');
    expect(recuperado?.historial).toHaveLength(1);
  });

  it('sobrevive un "reinicio del proceso" — una instancia NUEVA del repositorio, apuntando al mismo archivo, ve el mismo estado', async () => {
    const repoAntesDelReinicio = new JsonConversacionRepository(archivo);
    await repoAntesDelReinicio.guardar(estadoDePrueba('conv-1'));

    // Nada de estado compartido en memoria con la instancia de arriba — simula un proceso nuevo.
    const repoDespuesDelReinicio = new JsonConversacionRepository(archivo);
    const recuperado = await repoDespuesDelReinicio.obtener('conv-1');

    expect(recuperado?.conversacionId).toBe('conv-1');
    expect(recuperado?.estadoFlujo).toBe('ABIERTA');
  });

  it('actualizar una conversación existente no pisa a las demás', async () => {
    const repo = new JsonConversacionRepository(archivo);
    await repo.guardar(estadoDePrueba('conv-1'));
    await repo.guardar(estadoDePrueba('conv-2'));

    const conv1 = estadoDePrueba('conv-1');
    conv1.estadoFlujo = 'ESCALADA';
    await repo.guardar(conv1);

    expect((await repo.obtener('conv-1'))?.estadoFlujo).toBe('ESCALADA');
    expect((await repo.obtener('conv-2'))?.estadoFlujo).toBe('ABIERTA');
  });
});
