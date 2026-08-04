import type { ILlmClient } from '../../domain/asistente-ia/ports/out/ILlmClient.js';

interface GeminiGenerateResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
}

/**
 * Adaptador real — Google Gemini API (tier gratis de Google AI Studio).
 * La key nunca va en el código: se lee de GEMINI_API_KEY (backend/.env, gitignored)
 * y se manda por header, no por query string, para no dejarla en logs de acceso.
 * @see backend/.env.example
 */
export class GeminiClient implements ILlmClient {
  constructor(
    private readonly apiKey: string = process.env.GEMINI_API_KEY ?? '',
    private readonly model: string = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
  ) {
    if (!this.apiKey) {
      throw new Error(
        'GEMINI_API_KEY no configurado. Agregalo a backend/.env (ver backend/.env.example) — nunca al código.'
      );
    }
  }

  async preguntar(prompt: string): Promise<string> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`GEMINI_REQUEST_FAILED: ${res.status} ${detail}`);
    }

    const body = (await res.json()) as GeminiGenerateResponse;
    const texto = body.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!texto) {
      throw new Error('GEMINI_EMPTY_RESPONSE');
    }

    return texto.trim();
  }
}
