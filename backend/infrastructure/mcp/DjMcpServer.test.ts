import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { DeclaracionJuradaService } from '../../domain/declaracion-jurada/services/DeclaracionJuradaService.js';
import { EstadoDJ } from '../../domain/declaracion-jurada/types/EstadoDJ.js';
import { Rol } from '../../domain/administracion/types/Rol.js';
import type { DeclaracionJurada } from '../../domain/declaracion-jurada/entities/DeclaracionJurada.js';
import type {
  HistorialDJRecord,
  IDeclaracionJuradaRepository,
  ListarDJResult,
} from '../../domain/declaracion-jurada/ports/out/IDeclaracionJuradaRepository.js';
import type { INotificacionPublisher } from '../../domain/declaracion-jurada/ports/out/INotificacionPublisher.js';
import type { Usuario } from '../../domain/administracion/entities/Usuario.js';
import type { IUsuarioRepository } from '../../domain/administracion/ports/out/IUsuarioRepository.js';
import type { ActorContext } from '../../domain/declaracion-jurada/types/CrearDJ.js';
import { createDjMcpServer } from './DjMcpServer.js';

class FakeDJRepository implements IDeclaracionJuradaRepository {
  private readonly store = new Map<string, DeclaracionJurada>();

  async create(dj: DeclaracionJurada): Promise<DeclaracionJurada> {
    this.store.set(dj.id, dj);
    return dj;
  }

  async findById(djId: string): Promise<DeclaracionJurada | null> {
    return this.store.get(djId) ?? null;
  }

  async list(params: { estado?: EstadoDJ; docenteId?: string; facultadId?: string }): Promise<ListarDJResult> {
    let items = [...this.store.values()];
    if (params.estado) items = items.filter((d) => d.estado === params.estado);
    if (params.docenteId) items = items.filter((d) => d.docenteId === params.docenteId);
    if (params.facultadId) items = items.filter((d) => d.facultadId === params.facultadId);
    return { items, total: items.length };
  }

  async updateCampos(djId: string, camposFormulario: Record<string, unknown>): Promise<DeclaracionJurada> {
    const dj = this.store.get(djId);
    if (!dj) throw new Error('DJ_NOT_FOUND');
    dj.camposFormulario = camposFormulario;
    return dj;
  }

  async transicionarAtomica(params: {
    djId: string;
    estadoNuevo: EstadoDJ;
    actorId: string;
    estadoAnterior: EstadoDJ;
    observaciones?: string;
  }): Promise<HistorialDJRecord> {
    const dj = this.store.get(params.djId);
    if (!dj) throw new Error('DJ_NOT_FOUND');
    dj.estado = params.estadoNuevo;
    return {
      id: randomUUID(),
      djId: params.djId,
      actorId: params.actorId,
      estadoAnterior: params.estadoAnterior,
      estadoNuevo: params.estadoNuevo,
      observaciones: params.observaciones,
      timestamp: new Date(),
    };
  }

  async getHistorial(): Promise<HistorialDJRecord[]> {
    return [];
  }
}

class FakeUsuarioRepository implements IUsuarioRepository {
  constructor(private readonly usuarios: Usuario[]) {}
  async findByEmail(): Promise<Usuario | null> {
    return null;
  }
  async listar(): Promise<Usuario[]> {
    return this.usuarios;
  }
  async registrarIntentoFallido(): Promise<void> {}
  async registrarLoginExitoso(): Promise<void> {}
}

class FakeNotificacionPublisher implements INotificacionPublisher {
  async publicarDjStateChanged(): Promise<void> {}
}

const ACTOR: ActorContext = { userId: 'u1', rol: Rol.ADMIN_FACULTAD, facultadId: 'facultad-1' };

async function conectarClienteReal(deps: { djService: DeclaracionJuradaService; usuarios: IUsuarioRepository }) {
  const server = createDjMcpServer(ACTOR, deps);
  const [transporteServidor, transporteCliente] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'dj-mcp-server-test', version: '1.0.0' });
  await server.connect(transporteServidor);
  await client.connect(transporteCliente);
  return client;
}

/**
 * A diferencia de AgenteDJService.test.ts (que fakea el cliente MCP), acá se usa el SDK real
 * de punta a punta — createDjMcpServer + Client + InMemoryTransport.createLinkedPair() — para
 * probar que el protocolo MCP genuino (tools/list, tools/call, JSON Schema) funciona de verdad.
 */
describe('DjMcpServer — wiring MCP real', () => {
  it('tools/list expone las 5 herramientas con JSON Schema válido', async () => {
    const djService = new DeclaracionJuradaService(new FakeDJRepository(), new FakeNotificacionPublisher());
    const client = await conectarClienteReal({ djService, usuarios: new FakeUsuarioRepository([]) });

    const { tools } = await client.listTools();

    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        'buscar_docente_por_nombre',
        'consultar_declaracion_jurada',
        'consultar_reglas_transicion',
        'listar_declaraciones_juradas',
        'transicionar_declaracion_jurada',
      ].sort()
    );
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe('object');
    }

    await client.close();
  });

  it('tools/call real de punta a punta — consultar_reglas_transicion (no necesita repos)', async () => {
    const djService = new DeclaracionJuradaService(new FakeDJRepository(), new FakeNotificacionPublisher());
    const client = await conectarClienteReal({ djService, usuarios: new FakeUsuarioRepository([]) });

    const resultado = await client.callTool({
      name: 'consultar_reglas_transicion',
      arguments: { estado: EstadoDJ.EN_REVISION_FACULTAD },
    });

    expect(resultado.isError).not.toBe(true);
    const bloque = Array.isArray(resultado.content) ? resultado.content[0] : undefined;
    expect(bloque?.type).toBe('text');
    const parsed = JSON.parse((bloque as { type: 'text'; text: string }).text) as { transicionesValidas: unknown[] };
    expect(parsed.transicionesValidas.length).toBeGreaterThan(0);

    await client.close();
  });

  it('listar_declaraciones_juradas sugiere reintentar sin filtro de estado si ese filtro no encontró nada', async () => {
    const djService = new DeclaracionJuradaService(new FakeDJRepository(), new FakeNotificacionPublisher());
    await djService.crear({
      docenteId: 'docente-1',
      facultadId: 'facultad-1',
      docenteVinculacionActiva: true,
      tipo: 'LABORAL',
      periodoAcademico: '2026-I',
      camposFormulario: {},
    });
    // La DJ recién creada queda en BORRADOR — un modelo que filtra por estado="APROBADA"
    // (asumiendo el resultado que busca) no debería encontrar nada... pero sí debería enterarse
    // de que el docente SÍ tiene una DJ, solo que en otro estado.
    const client = await conectarClienteReal({ djService, usuarios: new FakeUsuarioRepository([]) });

    const resultado = await client.callTool({
      name: 'listar_declaraciones_juradas',
      arguments: { docenteId: 'docente-1', estado: EstadoDJ.APROBADA },
    });

    const bloque = Array.isArray(resultado.content) ? resultado.content[0] : undefined;
    const parsed = JSON.parse((bloque as { type: 'text'; text: string }).text) as { total: number; sugerencia?: string };
    expect(parsed.total).toBe(0);
    expect(parsed.sugerencia).toContain('sin el filtro');

    await client.close();
  });

  it('tools/call con datos inválidos devuelve isError, nunca revienta el JSON-RPC', async () => {
    const djService = new DeclaracionJuradaService(new FakeDJRepository(), new FakeNotificacionPublisher());
    const client = await conectarClienteReal({ djService, usuarios: new FakeUsuarioRepository([]) });

    const resultado = await client.callTool({
      name: 'consultar_declaracion_jurada',
      arguments: { djId: 'no-existe' },
    });

    expect(resultado.isError).toBe(true);
    const bloque = Array.isArray(resultado.content) ? resultado.content[0] : undefined;
    const parsed = JSON.parse((bloque as { type: 'text'; text: string }).text) as { error: string };
    expect(parsed.error).toBe('DJ_NOT_FOUND');

    await client.close();
  });
});
