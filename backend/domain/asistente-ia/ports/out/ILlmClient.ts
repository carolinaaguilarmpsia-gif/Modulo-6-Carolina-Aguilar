/**
 * Puerto de salida — invocación a un modelo de lenguaje.
 * El dominio no sabe qué proveedor lo implementa (Ollama local, API de pago, etc.)
 * ni importa ningún SDK — mismo invariante hexagonal que el resto de SGAI (ADR-0001).
 */
export interface ILlmClient {
  preguntar(prompt: string): Promise<string>;
}
