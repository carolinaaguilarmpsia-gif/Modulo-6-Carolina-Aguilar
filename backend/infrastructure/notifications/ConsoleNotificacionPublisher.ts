import type { INotificacionPublisher } from '../../domain/declaracion-jurada/ports/out/INotificacionPublisher.js';
import type { EstadoDJ } from '../../domain/declaracion-jurada/types/EstadoDJ.js';

export class ConsoleNotificacionPublisher implements INotificacionPublisher {
  async publicarDjStateChanged(event: {
    djId: string;
    estadoNuevo: EstadoDJ;
    destinatarioRol: string;
  }): Promise<void> {
    // Solo metadatos — nunca campos_formulario (Ley 164)
    console.info('[NOTIF] DJ_STATE_CHANGED', {
      djId: event.djId,
      estadoNuevo: event.estadoNuevo,
      destinatarioRol: event.destinatarioRol,
    });
  }
}
