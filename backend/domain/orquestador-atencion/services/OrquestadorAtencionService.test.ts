import { randomUUID } from 'node:crypto';
import { Rol } from '../../administracion/types/Rol.js';
import type { Usuario } from '../../administracion/entities/Usuario.js';
import type { IUsuarioRepository } from '../../administracion/ports/out/IUsuarioRepository.js';
import { DeclaracionJuradaService } from '../../declaracion-jurada/services/DeclaracionJuradaService.js';
import { EstadoDJ } from '../../declaracion-jurada/types/EstadoDJ.js';
import type { DeclaracionJurada } from '../../declaracion-jurada/entities/DeclaracionJurada.js';
import type {
  HistorialDJRecord,
  IDeclaracionJuradaRepository,
  ListarDJResult,
} from '../../declaracion-jurada/ports/out/IDeclaracionJuradaRepository.js';
import type { INotificacionPublisher } from '../../declaracion-jurada/ports/out/INotificacionPublisher.js';
import type { ActorContext } from '../../declaracion-jurada/types/CrearDJ.js';
import { AsistenteTramitesService } from '../../tramites-dpa/services/AsistenteTramitesService.js';
import type { ITramiteRepository } from '../../tramites-dpa/ports/out/ITramiteRepository.js';
import type { DepartamentoTramites, TramiteConDepartamento } from '../../tramites-dpa/types/Tramite.js';
import type { ILlmClient as ILlmClientOrquestador } from '../ports/out/ILlmClient.js';
import type { IConversacionRepository } from '../ports/out/IConversacionRepository.js';
import type { EscalamientoInput, IEscalamientoPublisher } from '../ports/out/IEscalamientoPublisher.js';
import type { ConversacionEstado } from '../types/Orquestador.js';
import { Intencion } from '../types/Orquestador.js';
import { ClasificarIntencionService } from './ClasificarIntencionService.js';
import { OrquestadorAtencionService } from './OrquestadorAtencionService.js';

const ACTOR_DOCENTE: ActorContext = { userId: 'docente-1', rol: Rol.DOCENTE, facultadId: 'facultad-1' };
const ACTOR_ADMIN: ActorContext = { userId: 'admin-1', rol: Rol.ADMIN_FACULTAD, facultadId: 'facultad-1' };

class FakeUsuarioRepository implements IUsuarioRepository {
  public llamadasListar = 0;
  constructor(private readonly usuarios: Usuario[]) {}
  async findByEmail(): Promise<Usuario | null> {
    return null;
  }
  async listar(): Promise<Usuario[]> {
    this.llamadasListar += 1;
    return this.usuarios;
  }
  async registrarIntentoFallido(): Promise<void> {}
  async registrarLoginExitoso(): Promise<void> {}
}

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
    const dj = this.store.get(djId)!;
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
    const dj = this.store.get(params.djId)!;
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

class FakeNotificacionPublisher implements INotificacionPublisher {
  async publicarDjStateChanged(): Promise<void> {}
}

class FakeTramiteRepository implements ITramiteRepository {
  listarDepartamentos(): DepartamentoTramites[] {
    return [];
  }
  listarTodos(): TramiteConDepartamento[] {
    return [];
  }
  buscarPorCodigo(): TramiteConDepartamento | undefined {
    return undefined;
  }
}

class FakeConversacionRepository implements IConversacionRepository {
  public llamadasGuardar = 0;
  private readonly store = new Map<string, ConversacionEstado>();
  async obtener(conversacionId: string): Promise<ConversacionEstado | null> {
    const c = this.store.get(conversacionId);
    return c ? { ...c, historial: [...c.historial] } : null;
  }
  async guardar(estado: ConversacionEstado): Promise<void> {
    this.llamadasGuardar += 1;
    this.store.set(estado.conversacionId, { ...estado, historial: [...estado.historial] });
  }
}

class FakeEscalamientoPublisher implements IEscalamientoPublisher {
  public llamadas: EscalamientoInput[] = [];
  async escalar(input: EscalamientoInput): Promise<void> {
    this.llamadas.push(input);
  }
}

/** LLM del clasificador — devuelve intenciones en el orden en que se van pidiendo. */
class FakeLlmClient implements ILlmClientOrquestador {
  private indice = 0;
  constructor(private readonly respuestas: string[]) {}
  async preguntar(): Promise<string> {
    const r = this.respuestas[Math.min(this.indice, this.respuestas.length - 1)];
    this.indice += 1;
    return r;
  }
}

function construirServicio(params: {
  usuarios?: Usuario[];
  respuestasClasificador: string[];
  djs?: DeclaracionJurada[];
}) {
  const usuarios = new FakeUsuarioRepository(params.usuarios ?? []);
  const djRepo = new FakeDJRepository();
  const djService = new DeclaracionJuradaService(djRepo, new FakeNotificacionPublisher());
  const asistenteTramites = new AsistenteTramitesService(new FakeTramiteRepository(), null, false);
  const conversaciones = new FakeConversacionRepository();
  const escalamiento = new FakeEscalamientoPublisher();
  const clasificador = new ClasificarIntencionService(new FakeLlmClient(params.respuestasClasificador));

  const service = new OrquestadorAtencionService(conversaciones, clasificador, usuarios, djService, asistenteTramites, escalamiento);

  return { service, usuarios, djRepo, conversaciones, escalamiento };
}

describe('OrquestadorAtencionService', () => {
  it('un docente pregunta por sus propias DJ sin necesitar identificarse — usa actor.userId directo', async () => {
    const { service, djRepo } = construirServicio({ respuestasClasificador: ['{"intencion": "CONSULTA_ESTADO_DJ"}'] });
    await djRepo.create({
      id: 'dj-1',
      docenteId: 'docente-1',
      facultadId: 'facultad-1',
      estado: EstadoDJ.EN_REVISION_FACULTAD,
      docenteVinculacionActiva: true,
      tipo: 'LABORAL',
      periodoAcademico: '2026-I',
      camposFormulario: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const resultado = await service.atender(ACTOR_DOCENTE, { mensaje: '¿en qué va mi declaración?' });

    expect(resultado.nodo).toBe('consultar_dj');
    expect(resultado.respuesta).toContain('EN_REVISION_FACULTAD');
  });

  it('un admin pregunta por un docente puntual — lo identifica por nombre y persiste el id para el próximo turno', async () => {
    const { service, usuarios, djRepo } = construirServicio({
      usuarios: [
        {
          id: 'docente-juan',
          email: 'juan@x.com',
          nombreCompleto: 'Juan Jaldín',
          passwordHashLocal: 'x',
          rol: Rol.DOCENTE,
          facultadId: 'facultad-1',
          vinculacionActiva: true,
          intentosFallidos: 0,
          bloqueadoHasta: null,
        },
      ],
      respuestasClasificador: [
        '{"intencion": "CONSULTA_ESTADO_DJ", "docente": "Juan Jaldín"}',
        '{"intencion": "CONSULTA_ESTADO_DJ"}',
      ],
    });
    await djRepo.create({
      id: 'dj-1',
      docenteId: 'docente-juan',
      facultadId: 'facultad-1',
      estado: EstadoDJ.APROBADA,
      docenteVinculacionActiva: true,
      tipo: 'LABORAL',
      periodoAcademico: '2026-I',
      camposFormulario: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const turno1 = await service.atender(ACTOR_ADMIN, { mensaje: '¿cómo va la declaración de Juan Jaldín?' });
    expect(turno1.nodo).toBe('consultar_dj');
    expect(turno1.respuesta).toContain('APROBADA');

    const llamadasAntes = usuarios.llamadasListar;
    // Mismo conversacionId, un mensaje que YA NO trae el nombre — si el estado no persistiera,
    // esto forzaría una nueva búsqueda (y probablemente fallaría por no encontrar "de nuevo").
    const turno2 = await service.atender(ACTOR_ADMIN, { conversacionId: turno1.conversacionId, mensaje: '¿y ahora?' });

    expect(turno2.nodo).toBe('consultar_dj');
    expect(turno2.respuesta).toContain('APROBADA');
    expect(usuarios.llamadasListar).toBe(llamadasAntes); // no repitió la búsqueda por nombre
  });

  it('nombre no encontrado — responde con las sugerencias reales, no un error genérico', async () => {
    const { service } = construirServicio({
      usuarios: [
        {
          id: 'docente-juan',
          email: 'juan@x.com',
          nombreCompleto: 'Juan Jaldín',
          passwordHashLocal: 'x',
          rol: Rol.DOCENTE,
          facultadId: 'facultad-1',
          vinculacionActiva: true,
          intentosFallidos: 0,
          bloqueadoHasta: null,
        },
      ],
      respuestasClasificador: ['{"intencion": "CONSULTA_ESTADO_DJ", "docente": "Juan Jaldim"}'],
    });

    const resultado = await service.atender(ACTOR_ADMIN, { mensaje: '¿cómo va la declaración de Juan Jaldim?' });

    expect(resultado.nodo).toBe('pedir_identificacion');
    expect(resultado.respuesta).toContain('Juan Jaldín');
  });

  it('admin sin mencionar ningún nombre — pide identificación en vez de buscar con el mensaje entero', async () => {
    const { service, usuarios } = construirServicio({
      usuarios: [
        {
          id: 'docente-juan',
          email: 'juan@x.com',
          nombreCompleto: 'Juan Jaldín',
          passwordHashLocal: 'x',
          rol: Rol.DOCENTE,
          facultadId: 'facultad-1',
          vinculacionActiva: true,
          intentosFallidos: 0,
          bloqueadoHasta: null,
        },
      ],
      respuestasClasificador: ['{"intencion": "CONSULTA_ESTADO_DJ"}'],
    });

    const resultado = await service.atender(ACTOR_ADMIN, { mensaje: '¿cómo va la declaración jurada?' });

    expect(resultado.nodo).toBe('pedir_identificacion');
    expect(resultado.respuesta).toContain('nombre completo');
    expect(usuarios.llamadasListar).toBe(0); // nunca intentó buscar sin un nombre real
  });

  it('reportar un problema escala a un humano y marca la conversación como ESCALADA', async () => {
    const { service, escalamiento } = construirServicio({ respuestasClasificador: ['{"intencion": "REPORTAR_PROBLEMA"}'] });

    const resultado = await service.atender(ACTOR_DOCENTE, { mensaje: 'esto no funciona, necesito hablar con alguien' });

    expect(resultado.nodo).toBe('escalar_humano');
    expect(resultado.estadoFlujo).toBe('ESCALADA');
    expect(escalamiento.llamadas).toHaveLength(1);
  });

  it('una conversación ya ESCALADA nunca vuelve a pasar por el clasificador — regla de negocio, no técnica', async () => {
    const { service } = construirServicio({ respuestasClasificador: ['{"intencion": "REPORTAR_PROBLEMA"}'] });

    const turno1 = await service.atender(ACTOR_DOCENTE, { mensaje: 'tengo un problema grave' });
    expect(turno1.estadoFlujo).toBe('ESCALADA');

    // Un mensaje que el clasificador (si se llamara) devolvería como DUDA_NORMATIVA —pero como
    // ya está ESCALADA, ni siquiera debería intentar clasificar: si esto fallara, el mock del LLM
    // tirado abajo lo delataría (solo tiene UNA respuesta cargada).
    const turno2 = await service.atender(ACTOR_DOCENTE, {
      conversacionId: turno1.conversacionId,
      mensaje: '¿qué requisitos necesito?',
    });

    expect(turno2.nodo).toBe('ya_escalada');
    expect(turno2.estadoFlujo).toBe('ESCALADA');
  });

  it('una intención no reconocida pide aclaración en vez de inventar una respuesta', async () => {
    const { service } = construirServicio({ respuestasClasificador: ['no entendí nada de esto'] });

    const resultado = await service.atender(ACTOR_DOCENTE, { mensaje: 'hola' });

    expect(resultado.intencion).toBe(Intencion.OTRO);
    expect(resultado.nodo).toBe('pedir_aclaracion');
  });

  it('cada turno se persiste — la conversación acumula historial real, no se pierde entre llamadas', async () => {
    const { service, conversaciones } = construirServicio({
      respuestasClasificador: ['{"intencion": "OTRO"}', '{"intencion": "OTRO"}'],
    });

    const turno1 = await service.atender(ACTOR_DOCENTE, { mensaje: 'hola' });
    await service.atender(ACTOR_DOCENTE, { conversacionId: turno1.conversacionId, mensaje: 'de nuevo hola' });

    const estado = await conversaciones.obtener(turno1.conversacionId);
    expect(estado?.historial).toHaveLength(2);
    expect(conversaciones.llamadasGuardar).toBe(2);
  });
});
