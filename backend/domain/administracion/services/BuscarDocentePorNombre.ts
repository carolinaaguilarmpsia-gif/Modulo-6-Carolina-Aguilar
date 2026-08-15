import { NotFoundError, ValidationError } from '../../shared/errors/DomainError.js';
import type { Usuario } from '../entities/Usuario.js';
import type { IUsuarioRepository } from '../ports/out/IUsuarioRepository.js';

/** minúsculas + sin diacríticos — "Jaldín" y "Jaldin" deben matchear igual. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Match parcial, insensible a mayúsculas y a tildes — quien pregunta puede escribir solo parte
 * del nombre, y no siempre con los mismos acentos que están cargados en el sistema (esto importa
 * especialmente cuando quien busca es un LLM, no una persona tipeando sobre un dato que ve en pantalla).
 * Extraído de ResponderConsultaDJService para reusarlo también desde la herramienta MCP
 * `buscar_docente_por_nombre` (backend/infrastructure/mcp/DjMcpServer.ts).
 */
export async function buscarDocentePorNombre(
  usuarios: IUsuarioRepository,
  nombreConsultado: string
): Promise<Usuario> {
  const todos = await usuarios.listar();
  const query = normalizar(nombreConsultado.trim());
  const coincidencias = todos.filter((u) => normalizar(u.nombreCompleto).includes(query));

  if (coincidencias.length === 0) {
    throw new NotFoundError('DOCENTE_NOT_FOUND');
  }
  if (coincidencias.length > 1) {
    throw new ValidationError('DOCENTE_AMBIGUO', {
      candidatos: coincidencias.map((u) => u.nombreCompleto),
    });
  }
  return coincidencias[0];
}
