/**
 * Puerto de salida — convierte texto en un vector de embeddings.
 * Puerto propio del dominio tramites-dpa (misma convención que ILlmClient.ts de esta carpeta)
 * aunque el adaptador real (OllamaEmbeddingsClient) sea compartido.
 */
export interface IEmbeddingsClient {
  embed(texto: string): Promise<number[]>;
}
