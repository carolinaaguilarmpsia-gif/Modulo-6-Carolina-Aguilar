import type { EstadoDJ } from '../../types/EstadoDJ.js';

/** Puerto de notificaciones — implementado en infrastructure (Bull) */
export interface INotificacionPublisher {
  publicarDjStateChanged(event: {
    djId: string;
    estadoNuevo: EstadoDJ;
    destinatarioRol: string;
  }): Promise<void>;
}
