/** @see FSD-UC-002 · docs/DIAGRAMS/state_dj.mmd */
export enum EstadoDJ {
  BORRADOR = 'BORRADOR',
  EN_REVISION_FACULTAD = 'EN_REVISION_FACULTAD',
  APROBADA = 'APROBADA',
  DEVUELTA = 'DEVUELTA',
  EN_REVISION_DPA = 'EN_REVISION_DPA',
  RECHAZADA = 'RECHAZADA',
}

const TERMINALES: ReadonlySet<EstadoDJ> = new Set([EstadoDJ.APROBADA, EstadoDJ.RECHAZADA]);

export function esEstadoTerminal(estado: EstadoDJ): boolean {
  return TERMINALES.has(estado);
}
