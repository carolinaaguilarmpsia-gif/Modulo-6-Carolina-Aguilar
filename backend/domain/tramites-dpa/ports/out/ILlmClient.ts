/**
 * Puerto de salida — invocación a un modelo de lenguaje.
 * Mismo contrato que domain/asistente-ia/ports/out/ILlmClient.ts (invariante hexagonal
 * ADR-0001: cada dominio declara su propio puerto, aunque el adaptador se comparta).
 */
export interface ILlmClient {
  preguntar(prompt: string): Promise<string>;
}
