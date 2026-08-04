import { Rol } from '../../administracion/types/Rol.js';
import { ForbiddenError, ValidationError } from '../../shared/errors/DomainError.js';
import { ComandoDJ } from '../types/ComandoDJ.js';
import { EstadoDJ, esEstadoTerminal } from '../types/EstadoDJ.js';

/**
 * Contexto puro para resolver una transición (sin I/O).
 * @see PR-FSD-UC-002 Reasoning pasos 2–4
 */
export interface DJTransitionContext {
  estadoActual: EstadoDJ;
  comando: ComandoDJ;
  actorRol: Rol;
  /** Facultad del actor (JWT) — requerida para ADMIN_FACULTAD */
  actorFacultadId?: string;
  /** Facultad de la DJ */
  djFacultadId: string;
  /** RB-01 — precargado desde repositorio/docente */
  docenteVinculacionActiva: boolean;
  observaciones?: string;
}

export interface DJTransitionResolution {
  estadoAnterior: EstadoDJ;
  estadoNuevo: EstadoDJ;
}

type TransitionRule = {
  desde: EstadoDJ;
  comando: ComandoDJ;
  hacia: EstadoDJ;
  rolesPermitidos: readonly Rol[];
  requiereObservaciones?: boolean;
  requiereMismaFacultad?: boolean;
  requiereVinculacionActiva?: boolean;
};

/**
 * Tabla canónica — docs/SKILLS/dj-validator.md § Transiciones Válidas
 * @see FSD-UC-002
 */
const REGLAS: readonly TransitionRule[] = [
  {
    desde: EstadoDJ.BORRADOR,
    comando: ComandoDJ.ENVIAR,
    hacia: EstadoDJ.EN_REVISION_FACULTAD,
    rolesPermitidos: [Rol.DOCENTE],
    requiereVinculacionActiva: true,
  },
  {
    desde: EstadoDJ.EN_REVISION_FACULTAD,
    comando: ComandoDJ.APROBAR,
    hacia: EstadoDJ.APROBADA,
    rolesPermitidos: [Rol.ADMIN_FACULTAD],
    requiereMismaFacultad: true,
  },
  {
    desde: EstadoDJ.EN_REVISION_FACULTAD,
    comando: ComandoDJ.DEVOLVER,
    hacia: EstadoDJ.DEVUELTA,
    rolesPermitidos: [Rol.ADMIN_FACULTAD],
    requiereMismaFacultad: true,
    requiereObservaciones: true,
  },
  {
    desde: EstadoDJ.EN_REVISION_FACULTAD,
    comando: ComandoDJ.ESCALAR_DPA,
    hacia: EstadoDJ.EN_REVISION_DPA,
    rolesPermitidos: [Rol.ADMIN_FACULTAD],
    requiereMismaFacultad: true,
  },
  {
    desde: EstadoDJ.DEVUELTA,
    comando: ComandoDJ.REENVIAR,
    hacia: EstadoDJ.EN_REVISION_FACULTAD,
    rolesPermitidos: [Rol.DOCENTE],
  },
  {
    desde: EstadoDJ.EN_REVISION_DPA,
    comando: ComandoDJ.APROBAR,
    hacia: EstadoDJ.APROBADA,
    rolesPermitidos: [Rol.TECNICO_DPA],
  },
  {
    desde: EstadoDJ.EN_REVISION_DPA,
    comando: ComandoDJ.RECHAZAR,
    hacia: EstadoDJ.RECHAZADA,
    rolesPermitidos: [Rol.TECNICO_DPA],
    requiereObservaciones: true,
  },
] as const;

const ESTADOS_INMUTABLES_CAMPOS: ReadonlySet<EstadoDJ> = new Set([
  EstadoDJ.APROBADA,
  EstadoDJ.EN_REVISION_FACULTAD,
  EstadoDJ.EN_REVISION_DPA,
]);

/**
 * Máquina de estados pura de Declaraciones Juradas.
 * Sin Prisma, Express ni infraestructura.
 *
 * @see FSD-UC-002
 * @see PR-FSD-UC-002
 * @see RB-01 vinculacion_activa en ENVIAR
 * @see RB-03 inmutabilidad de campos en revisión/aprobada
 */
export class DJStateMachine {
  /**
   * RB-03 — rechaza edición de campos del formulario (PATCH), no transiciones de estado.
   * @see sgai-domain.mdc RB-03
   */
  static assertCamposEditables(estadoActual: EstadoDJ): void {
    if (ESTADOS_INMUTABLES_CAMPOS.has(estadoActual)) {
      throw new ForbiddenError('FORBIDDEN_TRANSITION', { estado: estadoActual, accion: 'EDITAR_CAMPOS' });
    }
  }

  /**
   * Resuelve el estado destino validando rol, guards y reglas CEUB.
   * @throws NotFoundError vía capa superior si DJ no existe
   * @throws ForbiddenError INACTIVE_BINDING | FORBIDDEN_TRANSITION
   * @throws ValidationError INVALID_STATE_TRANSITION | OBSERVATIONS_REQUIRED
   */
  static resolveTransition(ctx: DJTransitionContext): DJTransitionResolution {
    const { estadoActual, comando } = ctx;

    if (esEstadoTerminal(estadoActual)) {
      throw new ForbiddenError('FORBIDDEN_TRANSITION', {
        estado: estadoActual,
        comando,
        razon: 'ESTADO_TERMINAL',
      });
    }

    const regla = REGLAS.find((r) => r.desde === estadoActual && r.comando === comando);

    if (!regla) {
      throw new ValidationError('INVALID_STATE_TRANSITION', {
        estadoActual,
        comando,
      });
    }

    if (!regla.rolesPermitidos.includes(ctx.actorRol)) {
      throw new ForbiddenError('FORBIDDEN_TRANSITION', {
        actorRol: ctx.actorRol,
        comando,
        rolesPermitidos: regla.rolesPermitidos,
      });
    }

    if (regla.requiereMismaFacultad) {
      if (!ctx.actorFacultadId || ctx.actorFacultadId !== ctx.djFacultadId) {
        throw new ForbiddenError('FORBIDDEN_TRANSITION', {
          razon: 'CROSS_FACULTY_FORBIDDEN',
          actorFacultadId: ctx.actorFacultadId,
          djFacultadId: ctx.djFacultadId,
        });
      }
    }

    if (regla.requiereVinculacionActiva && !ctx.docenteVinculacionActiva) {
      throw new ForbiddenError('INACTIVE_BINDING', {
        comando: ComandoDJ.ENVIAR,
      });
    }

    if (regla.requiereObservaciones) {
      const obs = ctx.observaciones?.trim();
      if (!obs) {
        throw new ValidationError('OBSERVATIONS_REQUIRED', { comando });
      }
    }

    return {
      estadoAnterior: estadoActual,
      estadoNuevo: regla.hacia,
    };
  }

  /** Visualización / demo — lista transiciones desde un estado */
  static transicionesDesde(estado: EstadoDJ): ReadonlyArray<{ comando: ComandoDJ; hacia: EstadoDJ }> {
    return REGLAS.filter((r) => r.desde === estado).map((r) => ({
      comando: r.comando,
      hacia: r.hacia,
    }));
  }
}
