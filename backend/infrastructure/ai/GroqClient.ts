import type { ILlmClient } from '../../domain/asistente-ia/ports/out/ILlmClient.js';

interface GroqChatResponse {
  choices?: { message?: { content?: string } }[];
}

/**
 * Adaptador real — Groq (tier gratis, API compatible con OpenAI Chat Completions).
 * La key nunca va en el código: se lee de GROQ_API_KEY (backend/.env, gitignored).
 * @see backend/.env.example
 */
export class GroqClient implements ILlmClient {
  constructor(
    private readonly apiKey: string = process.env.GROQ_API_KEY ?? '',
    private readonly model: string = process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant'
  ) {
    if (!this.apiKey) {
      throw new Error(
        'GROQ_API_KEY no configurado. Agregalo a backend/.env (ver backend/.env.example) — nunca al código.'
      );
    }
  }

  async preguntar(prompt: string): Promise<string> {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`GROQ_REQUEST_FAILED: ${res.status} ${detail}`);
    }

    const body = (await res.json()) as GroqChatResponse;
    const texto = body.choices?.[0]?.message?.content;

    if (!texto) {
      throw new Error('GROQ_EMPTY_RESPONSE');
    }

    return texto.trim();
  }
}
