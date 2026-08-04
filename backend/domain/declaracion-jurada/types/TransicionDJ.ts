import type { Rol } from '../../administracion/types/Rol.js';
import type { ComandoDJ } from './ComandoDJ.js';
import type { EstadoDJ } from './EstadoDJ.js';

/** Comando de transición — PR-FSD-UC-002 Context */
export interface TransicionDJCommand {
  djId: string;
  comando: ComandoDJ;
  actorId: string;
  actorRol: Rol;
  actorFacultadId?: string;
  observaciones?: string;
}

/** Resultado tras persistencia atómica — PR-FSD-UC-002 Output */
export interface TransicionDJResult {
  djId: string;
  estadoAnterior: EstadoDJ;
  estadoNuevo: EstadoDJ;
  historialId: string;
  notificacionEncolada: boolean;
}
