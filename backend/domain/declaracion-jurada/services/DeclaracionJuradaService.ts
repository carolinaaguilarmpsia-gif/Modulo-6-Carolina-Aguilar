import { randomUUID } from 'node:crypto';
import { Rol } from '../../administracion/types/Rol.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors/DomainError.js';
import type { DeclaracionJurada } from '../entities/DeclaracionJurada.js';
import type { INotificacionPublisher } from '../ports/out/INotificacionPublisher.js';
import type { HistorialDJRecord, IDeclaracionJuradaRepository } from '../ports/out/IDeclaracionJuradaRepository.js';
import type { ActorContext, CrearDJCommand, ListarDJQuery } from '../types/CrearDJ.js';
import { EstadoDJ } from '../types/EstadoDJ.js';
import type { TransicionDJCommand, TransicionDJResult } from '../types/TransicionDJ.js';
import { DJStateMachine } from './DJStateMachine.js';

/**
 * Orquesta CRUD + FSM + persistencia atómica + notificación post-commit.
 * @see FSD-UC-002 · PR-FSD-UC-002
 */
export class DeclaracionJuradaService {
  constructor(
    private readonly repository: IDeclaracionJuradaRepository,
    private readonly notificaciones: INotificacionPublisher
  ) {}

  /**
   * Crear DJ en BORRADOR — RB-01 en creación.
   * @see FSD-UC-002 flujo principal paso 1–4
   */
  async crear(command: CrearDJCommand): Promise<DeclaracionJurada> {
    if (!command.docenteVinculacionActiva) {
      throw new ForbiddenError('INACTIVE_BINDING');
    }

    const now = new Date();
    const dj: DeclaracionJurada = {
      id: randomUUID(),
      docenteId: command.docenteId,
      facultadId: command.facultadId,
      estado: EstadoDJ.BORRADOR,
      docenteVinculacionActiva: command.docenteVinculacionActiva,
      tipo: command.tipo,
      periodoAcademico: command.periodoAcademico,
      camposFormulario: command.camposFormulario,
      createdAt: now,
      updatedAt: now,
    };

    return this.repository.create(dj);
  }

  async listar(actor: ActorContext, query: ListarDJQuery = {}): Promise<{ items: DeclaracionJurada[]; total: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const filters: Parameters<IDeclaracionJuradaRepository['list']>[0] = {
      page,
      pageSize,
      estado: query.estado as EstadoDJ | undefined,
    };

    if (actor.rol === Rol.DOCENTE) {
      filters.docenteId = actor.userId;
    } else if (actor.rol === Rol.ADMIN_FACULTAD && actor.facultadId) {
      filters.facultadId = actor.facultadId;
    }

    return this.repository.list(filters);
  }

  async obtenerDetalle(djId: string, actor: ActorContext): Promise<{ dj: DeclaracionJurada; historial: HistorialDJRecord[] }> {
    const dj = await this.repository.findById(djId);
    if (!dj) throw new NotFoundError('DJ_NOT_FOUND');

    this.assertPuedeVer(dj, actor);

    const historial = await this.repository.getHistorial(djId);
    return { dj, historial };
  }

  /**
   * PATCH campos — RB-03
   */
  async actualizarCampos(
    djId: string,
    camposFormulario: Record<string, unknown>,
    actor: ActorContext
  ): Promise<DeclaracionJurada> {
    const dj = await this.repository.findById(djId);
    if (!dj) throw new NotFoundError('DJ_NOT_FOUND');

    if (actor.rol === Rol.DOCENTE && dj.docenteId !== actor.userId) {
      throw new ForbiddenError('FORBIDDEN_TRANSITION');
    }

    this.assertPuedeEditarCampos(dj);

    return this.repository.updateCampos(djId, camposFormulario);
  }

  async transicionarEstado(command: TransicionDJCommand): Promise<TransicionDJResult> {
    const dj = await this.repository.findById(command.djId);
    if (!dj) throw new NotFoundError('DJ_NOT_FOUND');

    const { estadoAnterior, estadoNuevo } = DJStateMachine.resolveTransition({
      estadoActual: dj.estado,
      comando: command.comando,
      actorRol: command.actorRol,
      actorFacultadId: command.actorFacultadId,
      djFacultadId: dj.facultadId,
      docenteVinculacionActiva: dj.docenteVinculacionActiva,
      observaciones: command.observaciones,
    });

    const historial = await this.repository.transicionarAtomica({
      djId: command.djId,
      estadoNuevo,
      estadoAnterior,
      actorId: command.actorId,
      observaciones: command.observaciones,
    });

    let notificacionEncolada = false;
    try {
      await this.notificaciones.publicarDjStateChanged({
        djId: command.djId,
        estadoNuevo,
        destinatarioRol: this.inferirDestinatario(estadoNuevo),
      });
      notificacionEncolada = true;
    } catch {
      notificacionEncolada = false;
    }

    return {
      djId: command.djId,
      estadoAnterior,
      estadoNuevo,
      historialId: historial.id,
      notificacionEncolada,
    };
  }

  assertPuedeEditarCampos(dj: DeclaracionJurada): void {
    DJStateMachine.assertCamposEditables(dj.estado);
  }

  private assertPuedeVer(dj: DeclaracionJurada, actor: ActorContext): void {
    if (actor.rol === Rol.DOCENTE && dj.docenteId !== actor.userId) {
      throw new ForbiddenError('FORBIDDEN_TRANSITION');
    }
    if (actor.rol === Rol.ADMIN_FACULTAD && actor.facultadId !== dj.facultadId) {
      throw new ForbiddenError('FORBIDDEN_TRANSITION');
    }
  }

  private inferirDestinatario(estadoNuevo: EstadoDJ): string {
    switch (estadoNuevo) {
      case EstadoDJ.EN_REVISION_FACULTAD:
        return 'ADMIN_FACULTAD';
      case EstadoDJ.EN_REVISION_DPA:
        return 'TECNICO_DPA';
      case EstadoDJ.DEVUELTA:
        return 'DOCENTE';
      default:
        return 'DOCENTE';
    }
  }
}
