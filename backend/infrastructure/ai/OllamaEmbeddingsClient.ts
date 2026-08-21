import type { IEmbeddingsClient } from '../../domain/tramites-dpa/ports/out/IEmbeddingsClient.js';

interface OllamaEmbeddingsResponse {
  embedding: number[];
}

/**
 * Adaptador real — Ollama corriendo localmente (mismo servidor que OllamaClient.ts, otro
 * endpoint: POST /api/embeddings). Local y sin costo — no requiere API key.
 * @see backend/.env.example (OLLAMA_HOST, OLLAMA_EMBEDDING_MODEL)
 */
export class OllamaEmbeddingsClient implements IEmbeddingsClient {
  constructor(
    // 127.0.0.1 explícito, no "localhost" — mismo motivo que OllamaClient.ts (Node puede
    // resolver "localhost" a ::1 primero y Ollama solo escucha en IPv4).
    private readonly host: string = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434',
    private readonly model: string = process.env.OLLAMA_EMBEDDING_MODEL ?? 'nomic-embed-text'
  ) {}

  async embed(texto: string): Promise<number[]> {
    const res = await fetch(`${this.host}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt: texto }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`OLLAMA_EMBEDDINGS_REQUEST_FAILED: ${res.status} ${detail}`);
    }

    const body = (await res.json()) as OllamaEmbeddingsResponse;
    return body.embedding;
  }
}
