export interface EscalamientoInput {
  conversacionId: string;
  actorUserId: string;
  mensaje: string;
}

/** Puerto de salida — derivación a un humano cuando el flujo decide que la IA no debe seguir. */
export interface IEscalamientoPublisher {
  escalar(input: EscalamientoInput): Promise<void>;
}
