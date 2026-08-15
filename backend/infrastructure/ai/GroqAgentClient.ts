import type { IAgentLlmClient } from '../../domain/agente-dj/ports/out/IAgentLlmClient.js';
import type { AgentLlmTurn, AgentMessage, AgentToolCall, AgentToolDef } from '../../domain/agente-dj/types/Agente.js';

interface GroqToolCallWire {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface GroqChatResponseWire {
  choices?: { message?: { content?: string | null; tool_calls?: GroqToolCallWire[] } }[];
  usage?: { total_tokens?: number };
}

function aMensajeWire(m: AgentMessage): Record<string, unknown> {
  if (m.role === 'assistant' && m.toolCalls?.length) {
    return {
      role: 'assistant',
      content: m.content,
      tool_calls: m.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.nombre, arguments: JSON.stringify(tc.argumentos) },
      })),
    };
  }
  if (m.role === 'tool') {
    return { role: 'tool', tool_call_id: m.toolCallId, content: m.content ?? '' };
  }
  return { role: m.role, content: m.content ?? '' };
}

/** JSON.parse defensivo — mismo criterio que DecidirHerramientaLlmService.parsear: si el modelo manda argumentos mal formados, nunca revienta el loop. */
function aToolCall(tc: GroqToolCallWire): AgentToolCall {
  let argumentos: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(tc.function.arguments) as unknown;
    if (parsed && typeof parsed === 'object') argumentos = parsed as Record<string, unknown>;
  } catch {
    argumentos = {};
  }
  return { id: tc.id, nombre: tc.function.name, argumentos };
}

/**
 * Adaptador real de tool-calling para Groq — a diferencia de GroqClient (domain/asistente-ia),
 * este manda `tools` y lee `message.tool_calls`/`usage.total_tokens`. Groq es compatible con el
 * formato de OpenAI Chat Completions. Modelo fijado por env (nunca "latest"), igual que GroqClient.
 * @see backend/.env.example
 */
export class GroqAgentClient implements IAgentLlmClient {
  constructor(
    private readonly apiKey: string = process.env.GROQ_API_KEY ?? '',
    private readonly model: string = process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant'
  ) {
    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY no configurado');
    }
  }

  async siguienteTurno(mensajes: AgentMessage[], herramientas: AgentToolDef[]): Promise<AgentLlmTurn> {
    return this.intentarTurno(mensajes, herramientas, true);
  }

  /**
   * El tier gratuito de Groq limita tokens por minuto — con varios pasos del bucle ReAct
   * seguidos, es común pegarle al límite justo en el paso de escritura. En vez de rendirse
   * de una, se respeta el tiempo de espera que el propio Groq indica en el error 429 y se
   * reintenta UNA vez — nunca más, para no convertir esto en un loop de reintentos infinito.
   */
  private async intentarTurno(mensajes: AgentMessage[], herramientas: AgentToolDef[], permitirReintento: boolean): Promise<AgentLlmTurn> {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: mensajes.map(aMensajeWire),
        tools: herramientas.map((h) => ({
          type: 'function',
          function: { name: h.name, description: h.description, parameters: h.parameters },
        })),
        tool_choice: 'auto',
        // Una herramienta por paso — mantiene la traza 1:1 con el bucle ReAct.
        parallel_tool_calls: false,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');

      if (res.status === 429 && permitirReintento) {
        const esperaMs = parsearEsperaMs(detail) ?? 5000;
        await new Promise((resolve) => setTimeout(resolve, esperaMs));
        return this.intentarTurno(mensajes, herramientas, false);
      }

      throw new Error(`GROQ_REQUEST_FAILED: ${res.status} ${detail}`);
    }

    const body = (await res.json()) as GroqChatResponseWire;
    const mensaje = body.choices?.[0]?.message;
    const llamadas = (mensaje?.tool_calls ?? []).map(aToolCall);

    return {
      contenido: llamadas.length > 0 ? null : (mensaje?.content ?? null),
      llamadasHerramientas: llamadas,
      tokensUsados: body.usage?.total_tokens ?? 0,
    };
  }
}

/** Extrae "Please try again in 6.89s" del cuerpo de error de Groq → milisegundos + margen. */
function parsearEsperaMs(detalleError: string): number | null {
  const m = detalleError.match(/try again in ([\d.]+)s/i);
  if (!m) return null;
  return Math.ceil(parseFloat(m[1]) * 1000) + 750;
}
