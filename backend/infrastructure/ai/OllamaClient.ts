import type { ILlmClient } from '../../domain/asistente-ia/ports/out/ILlmClient.js';

interface OllamaGenerateResponse {
  response: string;
}

/**
 * Adaptador real — Ollama corriendo localmente (app nativa, no Docker).
 * API REST nativa de Ollama: POST /api/generate. Sin API key: es un modelo local.
 * @see backend/.env.example (OLLAMA_HOST, OLLAMA_MODEL)
 */
export class OllamaClient implements ILlmClient {
  constructor(
    // 127.0.0.1 explícito, no "localhost": Ollama solo escucha en IPv4 y Node a veces
    // resuelve "localhost" a ::1 (IPv6) primero, lo que da ECONNREFUSED aunque el
    // servidor esté corriendo.
    private readonly host: string = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434',
    private readonly model: string = process.env.OLLAMA_MODEL ?? 'llama3.2:3b'
  ) {}

  async preguntar(prompt: string): Promise<string> {
    const res = await fetch(`${this.host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`OLLAMA_REQUEST_FAILED: ${res.status} ${detail}`);
    }

    const body = (await res.json()) as OllamaGenerateResponse;
    return body.response.trim();
  }
}
