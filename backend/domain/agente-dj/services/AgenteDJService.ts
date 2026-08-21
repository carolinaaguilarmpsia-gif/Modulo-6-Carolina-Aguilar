import { randomUUID } from 'node:crypto';
import { ForbiddenError, NotFoundError } from '../../shared/errors/DomainError.js';
import { DJStateMachine } from '../../declaracion-jurada/services/DJStateMachine.js';
import type { ActorContext } from '../../declaracion-jurada/types/CrearDJ.js';
import type { EstadoDJ } from '../../declaracion-jurada/types/EstadoDJ.js';
import type { IAgentLlmClient } from '../ports/out/IAgentLlmClient.js';
import type { IAgentSessionStore } from '../ports/out/IAgentSessionStore.js';
import type { IAgentToolClient } from '../ports/out/IAgentToolClient.js';
import type { IAgentToolClientFactory } from '../ports/out/IAgentToolClientFactory.js';
import { HERRAMIENTA_ESCRITURA_DJ } from '../types/Agente.js';
import type { AgenteDJResult, AgentMessage, AgentToolDef, DJPreview, PasoTraza } from '../types/Agente.js';

/** Guardrail "freno" — nunca más de 6 vueltas del bucle Pensamiento→Acción→Observación. */
const MAX_PASOS = 6;

const SYSTEM_PROMPT = [
  'Sos un agente que revisa Declaraciones Juradas (DJ) de una universidad boliviana, bajo normativa CEUB.',
  'Nunca inventes un id, un estado o una regla — usá las herramientas para conseguir datos reales.',
  'Para "aprobá/rechazá la DJ de [docente] si corresponde", el orden es:',
  '1) buscar_docente_por_nombre 2) listar_declaraciones_juradas con SOLO docenteId, SIN estado (ahí salen djId y estado reales)',
  '3) consultar_reglas_transicion con ese estado real 4) recién ahí transicionar_declaracion_jurada si aplica.',
  'Error común a evitar: en el paso 2 NUNCA pongas estado="APROBADA" (ni ningún otro) pensando en el resultado que',
  'buscás — todavía no sabés el estado actual, por eso listás sin filtro de estado.',
  'transicionar_declaracion_jurada siempre pausa para confirmación humana — vos solo la proponés.',
  'Si buscar_docente_por_nombre no encuentra al docente pero la respuesta trae context.sugerencias, NUNCA digas',
  'simplemente "no existe" — proponé esos nombres reales ("¿Quisiste decir Juan Jaldín?") para que la persona confirme.',
].join('\n');

/**
 * El agente: bucle ReAct real (el modelo decide qué herramienta y en qué orden, encadenando
 * resultados) sobre las herramientas MCP de DJ. Los 3 guardrails viven acá: MAX_PASOS, la
 * pausa-y-confirma antes de escribir, y la traza que registra cada paso.
 */
export class AgenteDJService {
  constructor(
    private readonly llm: IAgentLlmClient,
    private readonly toolClientFactory: IAgentToolClientFactory,
    private readonly sessionStore: IAgentSessionStore
  ) {}

  async preguntar(actor: ActorContext, pregunta: string): Promise<AgenteDJResult> {
    const toolClient = await this.toolClientFactory.crear(actor);
    try {
      const herramientas = await toolClient.listarHerramientas();
      const mensajes: AgentMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: pregunta },
      ];

      return await this.ejecutarLoop(actor, mensajes, herramientas, toolClient);
    } finally {
      await toolClient.cerrar();
    }
  }

  /**
   * Guardrail "cinturón", segunda mitad — recién acá se ejecuta la escritura, y solo si el
   * mismo usuario que originó la sesión es quien confirma (nunca otro que adivine el sessionId).
   */
  async confirmar(actor: ActorContext, sessionId: string, confirmar: boolean): Promise<AgenteDJResult> {
    const sesion = this.sessionStore.obtener(sessionId);
    if (!sesion) {
      throw new NotFoundError('AGENTE_SESION_NOT_FOUND');
    }
    if (sesion.actorUserId !== actor.userId) {
      throw new ForbiddenError('AGENTE_SESION_AJENA');
    }
    this.sessionStore.eliminar(sessionId);

    if (!confirmar) {
      return { respuesta: 'Acción cancelada — no se ejecutó ningún cambio.', traza: sesion.traza };
    }

    const toolClient = await this.toolClientFactory.crear(sesion.actor);
    try {
      const { contenido, esError } = await toolClient.llamarHerramienta(
        sesion.herramientaPendiente.nombre,
        sesion.herramientaPendiente.argumentos
      );

      const traza: PasoTraza[] = [
        ...sesion.traza,
        {
          paso: sesion.traza.length + 1,
          herramienta: sesion.herramientaPendiente.nombre,
          argumentos: sesion.herramientaPendiente.argumentos,
          observacion: contenido,
        },
      ];

      return {
        traza,
        // Misma convención que AsistenteTramitesService: el LLM elige, el código redacta —
        // no hace falta otra llamada al modelo para anunciar un resultado que ya es un hecho.
        respuesta: esError ? `No se pudo completar la acción: ${contenido}` : this.resumirEjecucion(contenido),
      };
    } finally {
      await toolClient.cerrar();
    }
  }

  private async ejecutarLoop(
    actor: ActorContext,
    mensajes: AgentMessage[],
    herramientas: AgentToolDef[],
    toolClient: IAgentToolClient
  ): Promise<AgenteDJResult> {
    const traza: PasoTraza[] = [];

    for (let paso = 1; paso <= MAX_PASOS; paso++) {
      let turno;
      try {
        turno = await this.llm.siguienteTurno(mensajes, herramientas);
      } catch (err) {
        // El modelo puede fallar (llamada mal formada, rate limit, timeout, etc.) — nunca se
        // propaga como un 500 crudo: el agente corta acá y dice que no pudo, en vez de colgarse
        // o inventar. Se deja registro server-side porque esto es responsabilidad de Groq, no
        // del código, y conviene poder diferenciarlo de un bug real en logs de producción.
        console.error('[AgenteDJ] Error en turno del LLM', err instanceof Error ? err.message : err);
        traza.push({ paso, observacion: 'El modelo no pudo procesar este paso.' });
        return { respuesta: 'No pude completar tu consulta — hubo un problema al consultar al modelo. Intentá reformular la pregunta.', traza };
      }

      if (turno.llamadasHerramientas.length === 0) {
        traza.push({ paso, pensamiento: turno.contenido ?? undefined, tokensUsados: turno.tokensUsados });
        return { respuesta: turno.contenido ?? 'No tengo una respuesta.', traza };
      }

      const llamada = turno.llamadasHerramientas[0];
      mensajes.push({ role: 'assistant', content: turno.contenido, toolCalls: [llamada] });

      if (llamada.nombre === HERRAMIENTA_ESCRITURA_DJ) {
        const sessionId = randomUUID();
        const preview = await this.construirPreview(toolClient, llamada.argumentos);
        this.sessionStore.guardar(sessionId, {
          sessionId,
          actorUserId: actor.userId,
          actor,
          herramientaPendiente: { nombre: llamada.nombre, argumentos: llamada.argumentos },
          traza,
          creadoEn: new Date(),
        });

        return {
          traza,
          sessionId,
          confirmacionPendiente: {
            herramienta: llamada.nombre,
            argumentos: llamada.argumentos,
            resumen: this.resumirPropuesta(llamada.argumentos, preview),
            preview,
          },
        };
      }

      // Se le pasa la observación al modelo tal cual, sea o no un error — el próximo turno
      // decide qué hacer con eso (p. ej. no reintentar una transición que ya sabe inválida).
      const { contenido } = await toolClient.llamarHerramienta(llamada.nombre, llamada.argumentos);

      traza.push({
        paso,
        herramienta: llamada.nombre,
        argumentos: llamada.argumentos,
        observacion: contenido,
        tokensUsados: turno.tokensUsados,
      });

      mensajes.push({ role: 'tool', content: contenido, toolCallId: llamada.id });
    }

    return {
      respuesta: `No pude resolver la consulta en ${MAX_PASOS} pasos. Reformulá la pregunta o pedime algo más específico.`,
      traza,
    };
  }

  /**
   * Guardrail "preview" — antes de pausar por confirmación se consulta la DJ real (misma
   * herramienta de lectura que usaría el modelo) para que la tarjeta de confirmación muestre
   * de qué DJ se trata, no solo su id. Si la consulta falla (id inválido, etc.) se pausa igual
   * pero sin preview — nunca se bloquea la confirmación por esto.
   */
  private async construirPreview(toolClient: IAgentToolClient, argumentos: Record<string, unknown>): Promise<DJPreview | undefined> {
    const djId = typeof argumentos.djId === 'string' ? argumentos.djId : undefined;
    if (!djId) return undefined;

    const { contenido, esError } = await toolClient.llamarHerramienta('consultar_declaracion_jurada', { djId });
    if (esError) return undefined;

    try {
      const dj = JSON.parse(contenido) as {
        id: string;
        docenteId: string;
        facultadId: string;
        estado: EstadoDJ;
        tipo: string;
        periodoAcademico: string;
        camposFormulario: Record<string, unknown>;
      };
      const comando = String(argumentos.comando ?? '');
      const transicion = DJStateMachine.transicionesDesde(dj.estado).find((t) => t.comando === comando);

      return {
        djId: dj.id,
        docenteId: dj.docenteId,
        facultadId: dj.facultadId,
        tipo: dj.tipo,
        periodoAcademico: dj.periodoAcademico,
        estadoActual: dj.estado,
        estadoPropuesto: transicion?.hacia,
        comando,
        camposFormulario: dj.camposFormulario,
      };
    } catch {
      return undefined;
    }
  }

  private resumirPropuesta(argumentos: Record<string, unknown>, preview?: DJPreview): string {
    const djId = String(argumentos.djId ?? '?');
    const comando = String(argumentos.comando ?? '?');
    if (!preview) {
      return `El agente propone ejecutar ${comando} sobre la Declaración Jurada ${djId}. ¿Confirmás?`;
    }

    const destino = preview.estadoPropuesto ? ` (pasaría de ${preview.estadoActual} a ${preview.estadoPropuesto})` : '';
    return (
      `El agente propone ejecutar ${comando} sobre la DJ ${djId} — docente ${preview.docenteId}, ` +
      `tipo ${preview.tipo}, período ${preview.periodoAcademico}${destino}. Revisá el detalle antes de confirmar.`
    );
  }

  private resumirEjecucion(contenidoJson: string): string {
    try {
      const r = JSON.parse(contenidoJson) as { djId?: string; estadoAnterior?: string; estadoNuevo?: string };
      if (r.djId && r.estadoAnterior && r.estadoNuevo) {
        return `Listo — la DJ ${r.djId} pasó de ${r.estadoAnterior} a ${r.estadoNuevo}.`;
      }
    } catch {
      // cae al mensaje genérico de abajo
    }
    return 'Acción ejecutada.';
  }
}
