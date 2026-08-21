import { randomUUID } from 'node:crypto';
import { Rol } from '../../administracion/types/Rol.js';
import { buscarDocentePorNombre } from '../../administracion/services/BuscarDocentePorNombre.js';
import type { IUsuarioRepository } from '../../administracion/ports/out/IUsuarioRepository.js';
import type { DeclaracionJuradaService } from '../../declaracion-jurada/services/DeclaracionJuradaService.js';
import type { ActorContext } from '../../declaracion-jurada/types/CrearDJ.js';
import { NotFoundError, ValidationError } from '../../shared/errors/DomainError.js';
import type { AsistenteTramitesService } from '../../tramites-dpa/services/AsistenteTramitesService.js';
import type { IConversacionRepository } from '../ports/out/IConversacionRepository.js';
import type { IEscalamientoPublisher } from '../ports/out/IEscalamientoPublisher.js';
import { ClasificarIntencionService } from './ClasificarIntencionService.js';
import { Intencion } from '../types/Orquestador.js';
import type { AtenderInput, AtenderResult, ConversacionEstado } from '../types/Orquestador.js';

/**
 * Orquestador — Nivel 5: decide QUÉ nodo se ejecuta (clasificar → rama de negocio → nodo),
 * CON QUÉ DATOS (reusa el docenteId ya identificado en un turno anterior si lo hay), y QUÉ PASA
 * CUANDO ALGO FALLA (cada nodo degrada a una respuesta segura, nunca cuelga el flujo). El estado
 * se persiste en disco (@see IConversacionRepository) — sobrevive un reinicio del proceso, a
 * diferencia de InMemoryAgentSessionStore del agente DJ.
 *
 * Reusa deliberadamente piezas ya construidas en vez de reimplementarlas: buscarDocentePorNombre
 * (con sus sugerencias), DeclaracionJuradaService (con su propio filtro por rol) y
 * AsistenteTramitesService (con su router keyword→RAG→LLM). Orquestar es decidir el camino, no
 * duplicar lo que cada pieza ya resuelve mejor por su cuenta.
 */
export class OrquestadorAtencionService {
  constructor(
    private readonly conversaciones: IConversacionRepository,
    private readonly clasificador: ClasificarIntencionService,
    private readonly usuarios: IUsuarioRepository,
    private readonly djService: DeclaracionJuradaService,
    private readonly asistenteTramites: AsistenteTramitesService,
    private readonly escalamiento: IEscalamientoPublisher
  ) {}

  async atender(actor: ActorContext, input: AtenderInput): Promise<AtenderResult> {
    const conversacion = await this.cargarOCrear(actor, input.conversacionId);

    // Rama de NEGOCIO sobre estado persistido: una vez escalada, esta conversación queda
    // cerrada a la IA para siempre — no es un reintento técnico, es una decisión de que a
    // partir de acá decide una persona. Sobrevive aunque el proceso se reinicie entre medio.
    if (conversacion.estadoFlujo === 'ESCALADA') {
      return this.responderYGuardar(
        conversacion,
        input.mensaje,
        Intencion.REPORTAR_PROBLEMA,
        'ya_escalada',
        'Tu caso ya fue derivado a una persona de la DPA — te va a contactar directamente. No hace falta que repitas la consulta acá.'
      );
    }

    const clasificacion = await this.clasificador.clasificar(input.mensaje);

    switch (clasificacion.intencion) {
      case Intencion.REPORTAR_PROBLEMA:
        return this.nodoEscalarHumano(conversacion, input.mensaje);
      case Intencion.CONSULTA_ESTADO_DJ:
        return this.nodoConsultarDJ(actor, conversacion, input.mensaje, clasificacion.docente);
      case Intencion.DUDA_NORMATIVA:
        return this.nodoConsultarNormativa(conversacion, input.mensaje);
      default:
        return this.nodoPedirAclaracion(conversacion, input.mensaje);
    }
  }

  private async nodoEscalarHumano(conversacion: ConversacionEstado, mensaje: string): Promise<AtenderResult> {
    // No deja caer el turno si el canal de escalamiento falla — igual avisa y marca ESCALADA,
    // porque la decisión de negocio (dejar de usar IA en esta conversación) no depende de si
    // la notificación salió o no.
    await this.escalamiento
      .escalar({ conversacionId: conversacion.conversacionId, actorUserId: conversacion.actorUserId, mensaje })
      .catch(() => undefined);

    conversacion.estadoFlujo = 'ESCALADA';
    return this.responderYGuardar(
      conversacion,
      mensaje,
      Intencion.REPORTAR_PROBLEMA,
      'escalar_humano',
      'Entendido — derivé tu caso a una persona de la DPA para que lo revise directamente. Te va a contactar a la brevedad.'
    );
  }

  private async nodoConsultarDJ(
    actor: ActorContext,
    conversacion: ConversacionEstado,
    mensaje: string,
    nombreMencionado?: string
  ): Promise<AtenderResult> {
    let docenteId = conversacion.docenteId;

    // Rama de NEGOCIO por rol: un docente pregunta por sí mismo (no hay nada que identificar);
    // un admin/DPA puede preguntar por cualquier docente, y para eso necesita el nombre —
    // extraído por el clasificador, nunca "el mensaje entero" (que casi nunca es solo un nombre).
    if (actor.rol === Rol.DOCENTE) {
      docenteId = actor.userId;
    } else if (!docenteId) {
      if (!nombreMencionado) {
        return this.responderYGuardar(
          conversacion,
          mensaje,
          Intencion.CONSULTA_ESTADO_DJ,
          'pedir_identificacion',
          '¿De qué docente querés consultar la declaración jurada? Decime el nombre completo.'
        );
      }
      const identificacion = await this.identificarDocentePorNombre(nombreMencionado);
      if (typeof identificacion !== 'string') {
        return this.responderYGuardar(conversacion, mensaje, Intencion.CONSULTA_ESTADO_DJ, 'pedir_identificacion', identificacion.respuesta);
      }
      docenteId = identificacion;
    }

    conversacion.docenteId = docenteId;

    // DeclaracionJuradaService.listar ya sabe filtrar "solo lo del docente" cuando el actor es
    // DOCENTE — se reusa esa regla en vez de reimplementarla acá con un filtro propio.
    const { items } = await this.djService.listar({ userId: docenteId, rol: Rol.DOCENTE });
    const texto =
      items.length === 0
        ? 'No hay declaraciones juradas registradas para ese docente.'
        : items.map((dj) => `${dj.periodoAcademico} (${dj.tipo}): ${dj.estado}`).join('\n');

    return this.responderYGuardar(conversacion, mensaje, Intencion.CONSULTA_ESTADO_DJ, 'consultar_dj', texto);
  }

  private async nodoConsultarNormativa(conversacion: ConversacionEstado, mensaje: string): Promise<AtenderResult> {
    const resultado = await this.asistenteTramites.preguntar(mensaje);
    return this.responderYGuardar(conversacion, mensaje, Intencion.DUDA_NORMATIVA, 'consultar_normativa', resultado.respuesta);
  }

  private async nodoPedirAclaracion(conversacion: ConversacionEstado, mensaje: string): Promise<AtenderResult> {
    return this.responderYGuardar(
      conversacion,
      mensaje,
      Intencion.OTRO,
      'pedir_aclaracion',
      'No entendí bien tu consulta — ¿es sobre el estado de una declaración jurada, sobre requisitos de un trámite, o querés reportar un problema?'
    );
  }

  /** Reusa buscarDocentePorNombre (con sus sugerencias por distancia de edición) en vez de reimplementar la búsqueda. */
  private async identificarDocentePorNombre(mensaje: string): Promise<string | { respuesta: string }> {
    try {
      const docente = await buscarDocentePorNombre(this.usuarios, mensaje);
      return docente.id;
    } catch (err) {
      if (err instanceof NotFoundError) {
        const sugerencias = (err.context?.sugerencias as string[] | undefined) ?? [];
        return {
          respuesta:
            sugerencias.length > 0
              ? `No encontré a ese docente. ¿Quisiste decir ${sugerencias.join(' / ')}?`
              : 'No encontré a ese docente — decime el nombre completo tal como está registrado en el sistema.',
        };
      }
      if (err instanceof ValidationError) {
        const candidatos = (err.context?.candidatos as string[] | undefined) ?? [];
        return { respuesta: `Hay más de un docente con ese nombre: ${candidatos.join(', ')}. ¿Cuál de todos?` };
      }
      throw err;
    }
  }

  private async cargarOCrear(actor: ActorContext, conversacionId?: string): Promise<ConversacionEstado> {
    if (conversacionId) {
      const existente = await this.conversaciones.obtener(conversacionId);
      if (existente) return existente;
    }
    const ahora = new Date().toISOString();
    return {
      conversacionId: conversacionId ?? randomUUID(),
      actorUserId: actor.userId,
      historial: [],
      estadoFlujo: 'ABIERTA',
      creadoEn: ahora,
      actualizadoEn: ahora,
    };
  }

  private async responderYGuardar(
    conversacion: ConversacionEstado,
    mensaje: string,
    intencion: Intencion,
    nodo: string,
    respuesta: string
  ): Promise<AtenderResult> {
    const timestamp = new Date().toISOString();
    conversacion.historial.push({ mensaje, intencion, nodo, respuesta, timestamp });
    conversacion.actualizadoEn = timestamp;
    await this.conversaciones.guardar(conversacion);

    return {
      conversacionId: conversacion.conversacionId,
      respuesta,
      intencion,
      nodo,
      estadoFlujo: conversacion.estadoFlujo,
    };
  }
}
