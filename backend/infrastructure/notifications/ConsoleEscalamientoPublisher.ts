import type { EscalamientoInput, IEscalamientoPublisher } from '../../domain/orquestador-atencion/ports/out/IEscalamientoPublisher.js';

/** Adaptador de demo — mismo criterio que ConsoleNotificacionPublisher.ts (DJ): en producción sería un ticket real a la mesa de la DPA. */
export class ConsoleEscalamientoPublisher implements IEscalamientoPublisher {
  async escalar(input: EscalamientoInput): Promise<void> {
    console.info('[ESCALAMIENTO] Caso derivado a un humano', {
      conversacionId: input.conversacionId,
      actorUserId: input.actorUserId,
      mensaje: input.mensaje,
    });
  }
}
