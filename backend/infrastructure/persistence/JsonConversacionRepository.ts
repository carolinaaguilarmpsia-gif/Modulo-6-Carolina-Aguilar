import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { IConversacionRepository } from '../../domain/orquestador-atencion/ports/out/IConversacionRepository.js';
import type { ConversacionEstado } from '../../domain/orquestador-atencion/types/Orquestador.js';

/**
 * Persistencia real en disco — a propósito, NO es un Map en memoria como
 * InMemoryAgentSessionStore. Es lo que hace que el estado del orquestador sobreviva un
 * `npm run dev` reiniciado a mitad de una conversación: la próxima vez que llega el mismo
 * conversacionId, retoma exactamente donde había quedado (docenteId ya identificado, si la
 * conversación ya fue ESCALADA, etc.).
 *
 * Lee y reescribe el archivo completo en cada operación — a la escala de una demo (decenas de
 * conversaciones, no miles concurrentes) es más simple y auditable que una base de datos, y
 * evita agregar una dependencia nueva solo para esto.
 */
export class JsonConversacionRepository implements IConversacionRepository {
  constructor(private readonly rutaArchivo: string) {}

  async obtener(conversacionId: string): Promise<ConversacionEstado | null> {
    const todas = this.leerTodas();
    return todas.find((c) => c.conversacionId === conversacionId) ?? null;
  }

  async guardar(estado: ConversacionEstado): Promise<void> {
    const todas = this.leerTodas();
    const indice = todas.findIndex((c) => c.conversacionId === estado.conversacionId);
    if (indice >= 0) {
      todas[indice] = estado;
    } else {
      todas.push(estado);
    }
    writeFileSync(this.rutaArchivo, JSON.stringify(todas, null, 2), 'utf-8');
  }

  private leerTodas(): ConversacionEstado[] {
    if (!existsSync(this.rutaArchivo)) return [];
    const contenido = readFileSync(this.rutaArchivo, 'utf-8').trim();
    if (!contenido) return [];
    return JSON.parse(contenido) as ConversacionEstado[];
  }
}
