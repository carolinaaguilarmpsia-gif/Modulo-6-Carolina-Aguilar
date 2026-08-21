import { useEffect, useRef, useState } from 'react';
import {
  obtenerEstadoAsistenteTramites,
  preguntarAsistenteTramites,
  type AsistenteTramitesResponse,
  type EstadoAsistenteTramites,
} from '../../../services/asistenteTramitesApi';
import { ApiError } from '../../../types/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  texto: string;
  datos?: AsistenteTramitesResponse;
  esError?: boolean;
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M11.3 1.05a.75.75 0 0 1 .4.87L10.1 8.5h4.65a.75.75 0 0 1 .58 1.23l-7 8.5a.75.75 0 0 1-1.3-.65L8.4 11.5H3.75a.75.75 0 0 1-.58-1.23l7-8.5a.75.75 0 0 1 .73-.22Z" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M9.5 2.5a.75.75 0 0 1 .72.55l.82 2.95 2.95.82a.75.75 0 0 1 0 1.44l-2.95.82-.82 2.95a.75.75 0 0 1-1.44 0l-.82-2.95-2.95-.82a.75.75 0 0 1 0-1.44l2.95-.82.82-2.95a.75.75 0 0 1 .72-.55ZM16 11.5a.6.6 0 0 1 .58.44l.4 1.45 1.45.4a.6.6 0 0 1 0 1.16l-1.45.4-.4 1.45a.6.6 0 0 1-1.16 0l-.4-1.45-1.45-.4a.6.6 0 0 1 0-1.16l1.45-.4.4-1.45a.6.6 0 0 1 .58-.44Z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M9 3.5a5.5 5.5 0 1 0 3.61 9.65l3.12 3.12a.75.75 0 1 0 1.06-1.06l-3.12-3.12A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M9.28 3.28a1.25 1.25 0 0 1 1.44 0c.24.17.4.4.5.62l6.02 11.5a1.25 1.25 0 0 1-1.11 1.85H3.87a1.25 1.25 0 0 1-1.11-1.85l6.02-11.5c.1-.22.26-.45.5-.62ZM10 7.25a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0V8a.75.75 0 0 1 .75-.75Zm0 6.5a.85.85 0 1 1 0 1.7.85.85 0 0 1 0-1.7Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Etiqueta verde/bolt (keyword, determinístico), azul/lupa (RAG por embeddings) o morada/sparkles (LLM eligió la herramienta). */
function CaminoBadge({ camino, similitud }: { camino: 'keyword' | 'rag' | 'llm'; similitud?: number }) {
  if (camino === 'keyword') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
        <BoltIcon /> Keyword
      </span>
    );
  }
  if (camino === 'rag') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
        <SearchIcon /> RAG{similitud !== undefined ? ` · similitud ${similitud.toFixed(2)}` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-800">
      <SparklesIcon /> LLM
    </span>
  );
}

function FueraDeAlcanceBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
      <WarningIcon /> Fuera de alcance
    </span>
  );
}

function FuenteBadge({ codigo, departamento }: { codigo: string; departamento: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
      Fuente: db.json → {departamento} → {codigo}
    </span>
  );
}

function HerramientaBadge({ herramienta }: { herramienta: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-institucional-600/40 bg-institucional-700/5 px-2 py-0.5 text-[11px] font-mono font-medium text-institucional-700">
      {herramienta}
    </span>
  );
}

function id(): string {
  return Math.random().toString(36).slice(2);
}

const SALUDO: ChatMessage = {
  id: 'saludo',
  role: 'assistant',
  texto:
    'Hola, soy el asistente de trámites de la DPA. Preguntame por requisitos, tiempos o normativa de un trámite (por ejemplo: "¿Qué requisitos necesito para el certificado de trabajo?").',
};

/** @see FSD-UC — chat público en el login: cada respuesta indica su camino (keyword/LLM) y su fuente real en db.json. */
export function AsistenteTramitesChat() {
  const [mensajes, setMensajes] = useState<ChatMessage[]>([SALUDO]);
  const [pregunta, setPregunta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState<EstadoAsistenteTramites | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    obtenerEstadoAsistenteTramites()
      .then(setEstado)
      .catch(() => setEstado(null));
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [mensajes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const texto = pregunta.trim();
    if (!texto || enviando) return;

    setMensajes((prev) => [...prev, { id: id(), role: 'user', texto }]);
    setPregunta('');
    setEnviando(true);

    try {
      const datos = await preguntarAsistenteTramites(texto);
      setEstado((prev) => (prev ? { ...prev, iaHabilitada: datos.iaHabilitada } : prev));
      setMensajes((prev) => [...prev, { id: id(), role: 'assistant', texto: datos.respuesta, datos }]);
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

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-institucional-600">Asistente DPA</p>
        <h2 className="text-sm font-bold text-slate-900">Preguntá por un trámite</h2>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3" style={{ maxHeight: 420 }}>
        {mensajes.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-institucional-700 text-white'
                  : m.esError
                    ? 'bg-red-50 text-red-900'
                    : 'bg-slate-100 text-slate-900'
              }`}
            >
              <p className="whitespace-pre-line">{m.texto}</p>

              {m.datos?.tramitesDisponibles ? (
                <ul className="mt-2 space-y-1 text-xs text-slate-700">
                  {m.datos.tramitesDisponibles.map((dep) => (
                    <li key={dep.departamento}>
                      <span className="font-semibold">{dep.departamento}:</span>{' '}
                      {dep.tramites.map((t) => `${t.codigo} (${t.nombre})`).join(', ')}
                    </li>
                  ))}
                </ul>
              ) : null}

              {m.role === 'assistant' && m.datos ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {m.datos.camino ? (
                    <CaminoBadge camino={m.datos.camino} similitud={m.datos.similitud} />
                  ) : (
                    <FueraDeAlcanceBadge />
                  )}
                  {m.datos.herramienta ? <HerramientaBadge herramienta={m.datos.herramienta} /> : null}
                  {m.datos.fuente ? (
                    <FuenteBadge codigo={m.datos.fuente.codigo} departamento={m.datos.fuente.departamento} />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {enviando ? (
          <div className="flex justify-start">
            <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-500">Consultando db.json…</div>
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-slate-200 p-3">
        <label htmlFor="asistente-pregunta" className="sr-only">
          Escriba su pregunta sobre un trámite
        </label>
        <input
          id="asistente-pregunta"
          type="text"
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder="¿Qué requisitos necesito para...?"
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

      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2 text-[11px] text-slate-500">
        <span>
          Fuente de datos: <code className="rounded bg-slate-100 px-1">db.json</code>
        </span>
        {estado ? (
          <span className={`font-medium ${estado.iaHabilitada ? 'text-emerald-700' : 'text-slate-500'}`}>
            IA_HABILITADA: {estado.iaHabilitada ? 'activa' : 'desactivada'}
          </span>
        ) : null}
      </div>
    </div>
  );
}
