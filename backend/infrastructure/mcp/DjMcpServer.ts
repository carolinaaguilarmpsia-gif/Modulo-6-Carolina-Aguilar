import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { buscarDocentePorNombre } from '../../domain/administracion/services/BuscarDocentePorNombre.js';
import type { IUsuarioRepository } from '../../domain/administracion/ports/out/IUsuarioRepository.js';
import { DJStateMachine } from '../../domain/declaracion-jurada/services/DJStateMachine.js';
import type { DeclaracionJuradaService } from '../../domain/declaracion-jurada/services/DeclaracionJuradaService.js';
import type { ActorContext } from '../../domain/declaracion-jurada/types/CrearDJ.js';
import { ComandoDJ } from '../../domain/declaracion-jurada/types/ComandoDJ.js';
import { EstadoDJ } from '../../domain/declaracion-jurada/types/EstadoDJ.js';
import { DomainError } from '../../domain/shared/errors/DomainError.js';

export interface DjMcpServerDeps {
  djService: DeclaracionJuradaService;
  usuarios: IUsuarioRepository;
}

interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
  // El SDK tipa CallToolResult como un bag extensible ({[x: string]: unknown} en la superficie) —
  // sin este índice, TS no acepta ToolResult como retorno válido de un ToolCallback.
  [x: string]: unknown;
}

/**
 * Toda herramienta pasa por acá: si el dominio tira un DomainError (estado inválido, rol
 * insuficiente, etc.), se lo devuelve como observación estructurada — nunca como excepción
 * cruda de JSON-RPC — para que el agente pueda leerlo y decidir, en vez de colgarse.
 */
async function ejecutarHerramienta(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    const resultado = await fn();
    return { content: [{ type: 'text', text: JSON.stringify(resultado) }] };
  } catch (err) {
    if (err instanceof DomainError) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.code, message: err.message, context: err.context }) }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Error inesperado ejecutando la herramienta.' }) }],
      isError: true,
    };
  }
}

/**
 * Servidor MCP real (protocolo del SDK, no una simulación) para el agente de Declaraciones
 * Juradas. `actor` viene siempre del JWT autenticado (nunca de un argumento de herramienta) —
 * el LLM elige QUÉ trámite y QUÉ comando, jamás "como quién" actúa.
 * @see backend/infrastructure/mcp/InProcessMcpToolClient.ts — cómo se conecta el agente
 */
export function createDjMcpServer(actor: ActorContext, deps: DjMcpServerDeps): McpServer {
  const server = new McpServer({ name: 'sgai-dj-agent', version: '1.0.0' });

  server.registerTool(
    'buscar_docente_por_nombre',
    {
      description:
        'Busca un docente por nombre (parcial, sin distinguir mayúsculas/tildes). Devuelve su id real. ' +
        'Si no hay coincidencia, la respuesta es DOCENTE_NOT_FOUND con context.sugerencias — una lista de ' +
        'nombres reales parecidos (posible error de tipeo). Nunca respondas "no existe" sin revisar antes ' +
        'si vino esa lista: si vino, proponé esos nombres al usuario ("¿Quisiste decir...?") en vez de cortar la conversación.',
      inputSchema: {
        nombre: z.string().min(2).describe('Nombre o parte del nombre del docente'),
      },
    },
    async ({ nombre }) =>
      ejecutarHerramienta(async () => {
        const docente = await buscarDocentePorNombre(deps.usuarios, nombre);
        return {
          id: docente.id,
          nombreCompleto: docente.nombreCompleto,
          facultadId: docente.facultadId,
          vinculacionActiva: docente.vinculacionActiva,
        };
      })
  );

  server.registerTool(
    'listar_declaraciones_juradas',
    {
      description:
        'Lista DJs visibles para el usuario autenticado. Para encontrar la DJ de un docente puntual, llamala ' +
        'SOLO con docenteId (sin estado) — no adivines ni asumas un estado como filtro. Usá "estado" únicamente ' +
        'si el usuario pidió explícitamente filtrar por un estado conocido.',
      // .nullish() en vez de .optional(): modelos chicos a veces mandan `null` explícito en
      // campos que no quieren usar, en vez de omitir la clave — un .optional() puro rechaza
      // eso con un 400 de validación. Con .nullish() ambas formas son válidas.
      inputSchema: {
        docenteId: z.string().nullish().describe('Id real de docente'),
        estado: z.nativeEnum(EstadoDJ).nullish().describe('Omitir salvo que el usuario haya pedido ese estado explícitamente'),
      },
    },
    async ({ docenteId, estado }) =>
      ejecutarHerramienta(async () => {
        const docenteIdFiltro = docenteId ?? undefined;
        const estadoFiltro = estado ?? undefined;
        const { items, total } = await deps.djService.listar(actor, { estado: estadoFiltro, page: 1, pageSize: 100 });
        const filtrados = docenteIdFiltro ? items.filter((dj) => dj.docenteId === docenteIdFiltro) : items;

        // Salvaguarda contra un error frecuente del modelo: filtrar por el estado al que quiere
        // llegar (p. ej. estado="APROBADA" buscando si "ya está aprobada") en vez de listar sin
        // filtro para ver el estado real. Si eso pasa y da 0 resultados, se lo hacemos explícito
        // en vez de dejar que concluya "no existe" con un dato incompleto.
        let sugerencia: string | undefined;
        if (docenteIdFiltro && estadoFiltro && filtrados.length === 0) {
          const { items: sinFiltro } = await deps.djService.listar(actor, { page: 1, pageSize: 100 });
          const delDocente = sinFiltro.filter((dj) => dj.docenteId === docenteIdFiltro);
          if (delDocente.length > 0) {
            sugerencia = `Este docente no tiene DJs en estado ${estadoFiltro}, pero sí tiene ${delDocente.length} en otro(s) estado(s) — repetí la consulta sin el filtro "estado" para verlas.`;
          }
        }

        return {
          total: filtrados.length,
          totalEnAlcanceDelActor: total,
          items: filtrados.map((dj) => ({
            id: dj.id,
            docenteId: dj.docenteId,
            tipo: dj.tipo,
            periodoAcademico: dj.periodoAcademico,
            estado: dj.estado,
            updatedAt: dj.updatedAt.toISOString(),
          })),
          ...(sugerencia ? { sugerencia } : {}),
        };
      })
  );

  server.registerTool(
    'consultar_declaracion_jurada',
    {
      description: 'Detalle completo de una DJ por id real (nunca inventado — usar el id de listar_declaraciones_juradas).',
      inputSchema: {
        djId: z.string().min(1).describe('Id real, de listar_declaraciones_juradas'),
      },
    },
    async ({ djId }) =>
      ejecutarHerramienta(async () => {
        const { dj, historial } = await deps.djService.obtenerDetalle(djId, actor);
        return {
          id: dj.id,
          docenteId: dj.docenteId,
          facultadId: dj.facultadId,
          estado: dj.estado,
          docenteVinculacionActiva: dj.docenteVinculacionActiva,
          tipo: dj.tipo,
          periodoAcademico: dj.periodoAcademico,
          camposFormulario: dj.camposFormulario,
          createdAt: dj.createdAt.toISOString(),
          updatedAt: dj.updatedAt.toISOString(),
          totalHistorial: historial.length,
        };
      })
  );

  server.registerTool(
    'consultar_reglas_transicion',
    {
      description:
        'Reglas válidas (roles, si pide observaciones/misma facultad/vinculación activa) desde un estado de DJ. ' +
        'Usar el estado REAL de una DJ específica (de listar_declaraciones_juradas) — nunca un estado adivinado.',
      inputSchema: {
        estado: z.nativeEnum(EstadoDJ).describe('Estado real, nunca adivinado'),
      },
    },
    async ({ estado }) =>
      ejecutarHerramienta(async () => ({
        estado,
        transicionesValidas: DJStateMachine.transicionesDesde(estado),
      }))
  );

  server.registerTool(
    'transicionar_declaracion_jurada',
    {
      description:
        'ESCRITURA — cambia el estado de una DJ (ENVIAR/APROBAR/DEVOLVER/ESCALAR_DPA/REENVIAR/RECHAZAR). ' +
        'Se pausa para confirmación humana — no asumas que ya se ejecutó.',
      inputSchema: {
        djId: z.string().min(1).describe('Id real, de listar_declaraciones_juradas'),
        comando: z.nativeEnum(ComandoDJ),
        observaciones: z.string().min(10).nullish().describe('Obligatorio para DEVOLVER y RECHAZAR'),
      },
    },
    async ({ djId, comando, observaciones }) =>
      ejecutarHerramienta(async () =>
        deps.djService.transicionarEstado({
          djId,
          comando,
          actorId: actor.userId,
          actorRol: actor.rol,
          actorFacultadId: actor.facultadId,
          observaciones: observaciones ?? undefined,
        })
      )
  );

  return server;
}
