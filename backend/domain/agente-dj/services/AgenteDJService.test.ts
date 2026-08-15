import { ForbiddenError, NotFoundError } from '../../shared/errors/DomainError.js';
import { Rol } from '../../administracion/types/Rol.js';
import type { ActorContext } from '../../declaracion-jurada/types/CrearDJ.js';
import type { IAgentLlmClient } from '../ports/out/IAgentLlmClient.js';
import type { IAgentSessionStore } from '../ports/out/IAgentSessionStore.js';
import type { IAgentToolClient } from '../ports/out/IAgentToolClient.js';
import type { IAgentToolClientFactory } from '../ports/out/IAgentToolClientFactory.js';
import { HERRAMIENTA_ESCRITURA_DJ } from '../types/Agente.js';
import type { AgentLlmTurn, AgentMessage, AgentSessionRecord, AgentToolDef } from '../types/Agente.js';
import { AgenteDJService } from './AgenteDJService.js';

const ACTOR_ADMIN_FACULTAD: ActorContext = { userId: 'admin-1', rol: Rol.ADMIN_FACULTAD, facultadId: 'facultad-demo-001' };
const ACTOR_OTRO_USUARIO: ActorContext = { userId: 'admin-2', rol: Rol.ADMIN_FACULTAD, facultadId: 'facultad-demo-001' };

/** Devuelve los turnos en orden; si se acaban, repite el último — útil para simular un LLM que nunca termina. */
class FakeAgentLlmClient implements IAgentLlmClient {
  public llamadas = 0;
  constructor(private readonly turnos: AgentLlmTurn[]) {}

  async siguienteTurno(_mensajes: AgentMessage[], _herramientas: AgentToolDef[]): Promise<AgentLlmTurn> {
    const turno = this.turnos[Math.min(this.llamadas, this.turnos.length - 1)];
    this.llamadas += 1;
    return turno;
  }
}

class FakeAgentToolClient implements IAgentToolClient {
  public llamadas: { nombre: string; argumentos: Record<string, unknown> }[] = [];
  public cerrado = false;
  constructor(
    private readonly herramientas: AgentToolDef[],
    private readonly respuestas: Record<string, { contenido: string; esError: boolean }>
  ) {}

  async listarHerramientas(): Promise<AgentToolDef[]> {
    return this.herramientas;
  }

  async llamarHerramienta(nombre: string, argumentos: Record<string, unknown>): Promise<{ contenido: string; esError: boolean }> {
    this.llamadas.push({ nombre, argumentos });
    return this.respuestas[nombre] ?? { contenido: '{}', esError: false };
  }

  async cerrar(): Promise<void> {
    this.cerrado = true;
  }
}

class FakeAgentToolClientFactory implements IAgentToolClientFactory {
  public actoresUsados: ActorContext[] = [];
  constructor(private readonly client: FakeAgentToolClient) {}

  async crear(actor: ActorContext): Promise<IAgentToolClient> {
    this.actoresUsados.push(actor);
    return this.client;
  }
}

class FakeAgentSessionStore implements IAgentSessionStore {
  private readonly store = new Map<string, AgentSessionRecord>();
  guardar(sessionId: string, sesion: AgentSessionRecord): void {
    this.store.set(sessionId, sesion);
  }
  obtener(sessionId: string): AgentSessionRecord | undefined {
    return this.store.get(sessionId);
  }
  eliminar(sessionId: string): void {
    this.store.delete(sessionId);
  }
}

describe('AgenteDJService', () => {
  it('encadena varias herramientas de lectura antes de responder — el ReAct real, no un solo paso', async () => {
    const llm = new FakeAgentLlmClient([
      { contenido: null, llamadasHerramientas: [{ id: 't1', nombre: 'buscar_docente_por_nombre', argumentos: { nombre: 'Juan' } }], tokensUsados: 10 },
      { contenido: null, llamadasHerramientas: [{ id: 't2', nombre: 'listar_declaraciones_juradas', argumentos: { docenteId: 'doc-1' } }], tokensUsados: 12 },
      { contenido: 'Juan tiene 1 DJ en EN_REVISION_FACULTAD.', llamadasHerramientas: [], tokensUsados: 8 },
    ]);
    const toolClient = new FakeAgentToolClient([], {
      buscar_docente_por_nombre: { contenido: JSON.stringify({ id: 'doc-1' }), esError: false },
      listar_declaraciones_juradas: { contenido: JSON.stringify({ total: 1, estado: 'EN_REVISION_FACULTAD' }), esError: false },
    });
    const factory = new FakeAgentToolClientFactory(toolClient);
    const service = new AgenteDJService(llm, factory, new FakeAgentSessionStore());

    const resultado = await service.preguntar(ACTOR_ADMIN_FACULTAD, '¿Cuántas DJ tiene Juan?');

    expect(resultado.traza).toHaveLength(3);
    expect(resultado.traza[0].herramienta).toBe('buscar_docente_por_nombre');
    expect(resultado.traza[1].herramienta).toBe('listar_declaraciones_juradas');
    expect(resultado.respuesta).toContain('EN_REVISION_FACULTAD');
    expect(toolClient.llamadas).toHaveLength(2);
    expect(toolClient.cerrado).toBe(true);
  });

  it('MAX_PASOS se respeta — un LLM que nunca termina no cuelga el loop', async () => {
    const llm = new FakeAgentLlmClient([
      {
        contenido: null,
        llamadasHerramientas: [{ id: 't1', nombre: 'consultar_reglas_transicion', argumentos: { estado: 'BORRADOR' } }],
        tokensUsados: 10,
      },
    ]);
    const toolClient = new FakeAgentToolClient([], { consultar_reglas_transicion: { contenido: '{}', esError: false } });
    const factory = new FakeAgentToolClientFactory(toolClient);
    const service = new AgenteDJService(llm, factory, new FakeAgentSessionStore());

    const resultado = await service.preguntar(ACTOR_ADMIN_FACULTAD, '¿algo sin fin?');

    expect(resultado.traza).toHaveLength(6);
    expect(resultado.respuesta).toContain('No pude resolver');
    expect(resultado.confirmacionPendiente).toBeUndefined();
  });

  it('la herramienta de escritura pausa y NO se ejecuta hasta que alguien confirme', async () => {
    const llm = new FakeAgentLlmClient([
      {
        contenido: null,
        llamadasHerramientas: [{ id: 't1', nombre: HERRAMIENTA_ESCRITURA_DJ, argumentos: { djId: 'dj-1', comando: 'APROBAR' } }],
        tokensUsados: 10,
      },
    ]);
    const toolClient = new FakeAgentToolClient([], {});
    const factory = new FakeAgentToolClientFactory(toolClient);
    const service = new AgenteDJService(llm, factory, new FakeAgentSessionStore());

    const resultado = await service.preguntar(ACTOR_ADMIN_FACULTAD, 'Aprobá la DJ dj-1');

    expect(resultado.confirmacionPendiente?.herramienta).toBe(HERRAMIENTA_ESCRITURA_DJ);
    expect(resultado.sessionId).toBeDefined();
    expect(toolClient.llamadas).toHaveLength(0);
  });

  it('confirmar(true) ejecuta la escritura y redacta la respuesta desde el resultado real, no el LLM', async () => {
    const llm = new FakeAgentLlmClient([
      {
        contenido: null,
        llamadasHerramientas: [{ id: 't1', nombre: HERRAMIENTA_ESCRITURA_DJ, argumentos: { djId: 'dj-1', comando: 'APROBAR' } }],
        tokensUsados: 10,
      },
    ]);
    const toolClient = new FakeAgentToolClient([], {
      [HERRAMIENTA_ESCRITURA_DJ]: {
        contenido: JSON.stringify({ djId: 'dj-1', estadoAnterior: 'EN_REVISION_FACULTAD', estadoNuevo: 'APROBADA' }),
        esError: false,
      },
    });
    const factory = new FakeAgentToolClientFactory(toolClient);
    const service = new AgenteDJService(llm, factory, new FakeAgentSessionStore());

    const propuesta = await service.preguntar(ACTOR_ADMIN_FACULTAD, 'Aprobá la DJ dj-1');
    const resultado = await service.confirmar(ACTOR_ADMIN_FACULTAD, propuesta.sessionId!, true);

    expect(resultado.respuesta).toContain('dj-1');
    expect(resultado.respuesta).toContain('APROBADA');
    expect(toolClient.llamadas).toEqual([{ nombre: HERRAMIENTA_ESCRITURA_DJ, argumentos: { djId: 'dj-1', comando: 'APROBAR' } }]);
  });

  it('confirmar(false) cancela sin ejecutar nada', async () => {
    const llm = new FakeAgentLlmClient([
      {
        contenido: null,
        llamadasHerramientas: [{ id: 't1', nombre: HERRAMIENTA_ESCRITURA_DJ, argumentos: { djId: 'dj-1', comando: 'RECHAZAR' } }],
        tokensUsados: 10,
      },
    ]);
    const toolClient = new FakeAgentToolClient([], {});
    const factory = new FakeAgentToolClientFactory(toolClient);
    const service = new AgenteDJService(llm, factory, new FakeAgentSessionStore());

    const propuesta = await service.preguntar(ACTOR_ADMIN_FACULTAD, 'Rechazá la DJ dj-1');
    const resultado = await service.confirmar(ACTOR_ADMIN_FACULTAD, propuesta.sessionId!, false);

    expect(resultado.respuesta).toContain('cancelada');
    expect(toolClient.llamadas).toHaveLength(0);
  });

  it('confirmar desde un usuario distinto al que originó la propuesta se rechaza', async () => {
    const llm = new FakeAgentLlmClient([
      {
        contenido: null,
        llamadasHerramientas: [{ id: 't1', nombre: HERRAMIENTA_ESCRITURA_DJ, argumentos: { djId: 'dj-1', comando: 'APROBAR' } }],
        tokensUsados: 10,
      },
    ]);
    const toolClient = new FakeAgentToolClient([], { [HERRAMIENTA_ESCRITURA_DJ]: { contenido: '{}', esError: false } });
    const factory = new FakeAgentToolClientFactory(toolClient);
    const service = new AgenteDJService(llm, factory, new FakeAgentSessionStore());

    const propuesta = await service.preguntar(ACTOR_ADMIN_FACULTAD, 'Aprobá la DJ dj-1');

    await expect(service.confirmar(ACTOR_OTRO_USUARIO, propuesta.sessionId!, true)).rejects.toThrow(ForbiddenError);
    expect(toolClient.llamadas).toHaveLength(0);
  });

  it('confirmar con un sessionId que no existe (o ya se usó) tira NotFoundError', async () => {
    const service = new AgenteDJService(
      new FakeAgentLlmClient([{ contenido: 'ok', llamadasHerramientas: [], tokensUsados: 1 }]),
      new FakeAgentToolClientFactory(new FakeAgentToolClient([], {})),
      new FakeAgentSessionStore()
    );

    await expect(service.confirmar(ACTOR_ADMIN_FACULTAD, 'no-existe', true)).rejects.toThrow(NotFoundError);
  });
});
