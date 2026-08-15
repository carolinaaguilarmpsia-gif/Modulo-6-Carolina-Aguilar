import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { IAgentToolClient } from '../../domain/agente-dj/ports/out/IAgentToolClient.js';
import type { IAgentToolClientFactory } from '../../domain/agente-dj/ports/out/IAgentToolClientFactory.js';
import type { AgentToolDef } from '../../domain/agente-dj/types/Agente.js';
import type { ActorContext } from '../../domain/declaracion-jurada/types/CrearDJ.js';
import { createDjMcpServer, type DjMcpServerDeps } from './DjMcpServer.js';

/**
 * Cliente MCP real, conectado al servidor de DjMcpServer por un par de transportes en memoria
 * (`InMemoryTransport.createLinkedPair()` — API documentada del SDK para uso embebido: son
 * mensajes JSON-RPC del protocolo MCP genuinos, solo que no salen por un socket).
 */
export class InProcessMcpToolClient implements IAgentToolClient {
  private constructor(private readonly client: Client) {}

  static async conectar(actor: ActorContext, deps: DjMcpServerDeps): Promise<InProcessMcpToolClient> {
    const server = createDjMcpServer(actor, deps);
    const [transporteServidor, transporteCliente] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'sgai-agente-dj', version: '1.0.0' });

    await server.connect(transporteServidor);
    await client.connect(transporteCliente);

    return new InProcessMcpToolClient(client);
  }

  /** tools/list — descubrimiento dinámico, el agente nunca tiene las herramientas hardcodeadas. */
  async listarHerramientas(): Promise<AgentToolDef[]> {
    const { tools } = await this.client.listTools();
    return tools.map((t) => ({
      name: t.name,
      description: t.description ?? '',
      parameters: (t.inputSchema ?? { type: 'object', properties: {} }) as Record<string, unknown>,
    }));
  }

  /** tools/call */
  async llamarHerramienta(nombre: string, argumentos: Record<string, unknown>): Promise<{ contenido: string; esError: boolean }> {
    const resultado = await this.client.callTool({ name: nombre, arguments: argumentos });
    const bloques = Array.isArray(resultado.content) ? resultado.content : [];
    const texto = bloques
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    return { contenido: texto || '(sin contenido)', esError: resultado.isError === true };
  }

  async cerrar(): Promise<void> {
    await this.client.close();
  }
}

/** Construye un cliente MCP fresco por actor — nunca un singleton compartido entre usuarios. */
export class InProcessMcpToolClientFactory implements IAgentToolClientFactory {
  constructor(private readonly deps: DjMcpServerDeps) {}

  async crear(actor: ActorContext): Promise<IAgentToolClient> {
    return InProcessMcpToolClient.conectar(actor, this.deps);
  }
}
