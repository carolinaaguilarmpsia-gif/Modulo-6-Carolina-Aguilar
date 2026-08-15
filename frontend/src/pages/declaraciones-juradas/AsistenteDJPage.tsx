import { useState } from 'react';
import { confirmarAgenteDJ, preguntarAgenteDJ } from '../../services/agenteDjApi';
import type { AgenteDJResponse, PasoTraza } from '../../types/api';
import { ApiError } from '../../types/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  texto: string;
  datos?: AgenteDJResponse;
  esError?: boolean;
}

function id(): string {
  return Math.random().toString(36).slice(2);
}

function TrazaPanel({ traza }: { traza: PasoTraza[] }) {
  if (traza.length === 0) return null;

  return (
    <details className="mt-2 rounded-md border border-slate-200 bg-white">
      <summary className="cursor-pointer px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
        Ver traza ({traza.length} {traza.length === 1 ? 'paso' : 'pasos'})
      </summary>
      <ol className="space-y-2 border-t border-slate-100 p-3 text-xs text-slate-700">
        {traza.map((p) => (
          <li key={p.paso} className="rounded bg-slate-50 p-2">
            <p className="font-semibold text-slate-800">
              Paso {p.paso}
              {p.tokensUsados ? <span className="ml-2 font-normal text-slate-500">· {p.tokensUsados} tokens</span> : null}
            </p>
            {p.herramienta ? (
              <p className="mt-1">
                <span className="font-mono text-institucional-700">{p.herramienta}</span>
                {p.argumentos ? <span className="text-slate-500"> {JSON.stringify(p.argumentos)}</span> : null}
              </p>
            ) : null}
            {p.observacion ? <p className="mt-1 text-slate-600">Observación: {p.observacion}</p> : null}
            {p.pensamiento ? <p className="mt-1 italic text-slate-600">{p.pensamiento}</p> : null}
          </li>
        ))}
      </ol>
    </details>
  );
}

function ConfirmacionCard({
  datos,
  onConfirmar,
  procesando,
}: {
  datos: AgenteDJResponse;
  onConfirmar: (confirmar: boolean) => void;
  procesando: boolean;
}) {
  if (!datos.confirmacionPendiente) return null;

  return (
    <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="text-sm font-semibold text-amber-900">Confirmación requerida</p>
      <p className="mt-1 text-sm text-amber-900">{datos.confirmacionPendiente.resumen}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={procesando}
          onClick={() => onConfirmar(true)}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          Confirmar
        </button>
        <button
          type="button"
          disabled={procesando}
          onClick={() => onConfirmar(false)}
          className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** Agente MCP sobre Declaraciones Juradas — bucle ReAct real con 3 guardrails: MAX_PASOS, confirmación de escritura, traza. */
export function AsistenteDJPage() {
  const [mensajes, setMensajes] = useState<ChatMessage[]>([
    {
      id: 'saludo',
      role: 'assistant',
      texto:
        'Hola, soy el agente de Declaraciones Juradas. Puedo buscar docentes, consultar DJs y reglas de transición, y proponer aprobaciones/rechazos — pero siempre te voy a pedir que confirmes antes de ejecutar un cambio.',
    },
  ]);
  const [pregunta, setPregunta] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const texto = pregunta.trim();
    if (!texto || enviando) return;

    setMensajes((prev) => [...prev, { id: id(), role: 'user', texto }]);
    setPregunta('');
    setEnviando(true);

    try {
      const datos = await preguntarAgenteDJ(texto);
      setMensajes((prev) => [
        ...prev,
        { id: id(), role: 'assistant', texto: datos.respuesta ?? 'Necesito que confirmes una acción antes de seguir.', datos },
      ]);
    } catch (err) {
      const texto2 =
        err instanceof ApiError
          ? (err.body.message ?? err.body.error)
          : 'No se pudo conectar con el servidor. Verifique que el backend esté corriendo.';
      setMensajes((prev) => [...prev, { id: id(), role: 'assistant', texto: texto2, esError: true }]);
    } finally {
      setEnviando(false);
    }
  };

  const handleConfirmar = async (mensajeId: string, sessionId: string, confirmar: boolean) => {
    setEnviando(true);
    try {
      const datos = await confirmarAgenteDJ(sessionId, confirmar);
      // Apaga la tarjeta de confirmación del mensaje original para que no se pueda usar dos veces.
      setMensajes((prev) =>
        prev.map((m) => (m.id === mensajeId && m.datos ? { ...m, datos: { ...m.datos, confirmacionPendiente: undefined } } : m))
      );
      setMensajes((prev) => [...prev, { id: id(), role: 'assistant', texto: datos.respuesta ?? 'Listo.', datos }]);
    } catch (err) {
      const texto2 = err instanceof ApiError ? (err.body.message ?? err.body.error) : 'No se pudo confirmar la acción.';
      setMensajes((prev) => [...prev, { id: id(), role: 'assistant', texto: texto2, esError: true }]);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-slate-900">Asistente MCP</h2>
        <p className="mt-1 text-sm text-slate-600">
          Agente con protocolo MCP real (descubre herramientas en runtime) sobre Declaraciones Juradas.
        </p>
      </div>

      <div className="flex h-[32rem] flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {mensajes.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                  m.role === 'user' ? 'bg-institucional-700 text-white' : m.esError ? 'bg-red-50 text-red-900' : 'bg-slate-100 text-slate-900'
                }`}
              >
                <p className="whitespace-pre-line">{m.texto}</p>
                {m.datos ? <TrazaPanel traza={m.datos.traza} /> : null}
                {m.datos?.confirmacionPendiente && m.datos.sessionId ? (
                  <ConfirmacionCard
                    datos={m.datos}
                    procesando={enviando}
                    onConfirmar={(confirmar) => void handleConfirmar(m.id, m.datos!.sessionId!, confirmar)}
                  />
                ) : null}
              </div>
            </div>
          ))}
          {enviando ? (
            <div className="flex justify-start">
              <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-500">Pensando…</div>
            </div>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-slate-200 p-3">
          <label htmlFor="agente-dj-pregunta" className="sr-only">
            Escriba su pregunta para el agente
          </label>
          <input
            id="agente-dj-pregunta"
            type="text"
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            placeholder='Ej: "Aprobá la DJ de Juan Jaldín si la normativa lo permite"'
            disabled={enviando}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-institucional-600 focus:outline-none focus:ring-2 focus:ring-institucional-600/30 disabled:bg-slate-100"
          />
          <button
            type="submit"
            disabled={enviando || !pregunta.trim()}
            className="rounded-md bg-institucional-700 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-institucional-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
