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

/** Distancia de edición clásica — cuántos cambios (insertar/borrar/sustituir) separan dos strings. */
function distanciaLevenshtein(a: string, b: string): number {
  const filas = a.length + 1;
  const columnas = b.length + 1;
  const matriz: number[][] = Array.from({ length: filas }, (_, i) => [i, ...new Array(columnas - 1).fill(0)]);
  for (let j = 1; j < columnas; j++) matriz[0][j] = j;

  for (let i = 1; i < filas; i++) {
    for (let j = 1; j < columnas; j++) {
      const costoSustitucion = a[i - 1] === b[j - 1] ? 0 : 1;
      matriz[i][j] = Math.min(
        matriz[i - 1][j] + 1, // borrar
        matriz[i][j - 1] + 1, // insertar
        matriz[i - 1][j - 1] + costoSustitucion // sustituir
      );
    }
  }
  return matriz[filas - 1][columnas - 1];
}

/** Mínima distancia contra el nombre completo o contra cualquiera de sus palabras sueltas — cubre tanto errores de tipeo en el nombre completo como en solo el nombre o apellido. */
function distanciaContraNombre(query: string, nombreCompletoNormalizado: string): number {
  const candidatos = [nombreCompletoNormalizado, ...nombreCompletoNormalizado.split(' ')];
  return Math.min(...candidatos.map((c) => distanciaLevenshtein(query, c)));
}

/**
 * Cuando no hay coincidencia exacta, en vez de devolver un simple "no existe" se buscan los
 * nombres más parecidos por distancia de edición — así el agente puede responder "¿quisiste decir
 * X?" en vez de cortar la conversación con un error. Umbral relativo al largo de la consulta:
 * tolera 1-2 letras de diferencia en nombres cortos y algunas más en nombres largos.
 */
function sugerirNombresSimilares(usuarios: Usuario[], query: string, maxSugerencias = 3): string[] {
  const umbral = Math.max(2, Math.ceil(query.length * 0.4));

  return usuarios
    .map((u) => ({ nombre: u.nombreCompleto, distancia: distanciaContraNombre(query, normalizar(u.nombreCompleto)) }))
    .filter((c) => c.distancia <= umbral)
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, maxSugerencias)
    .map((c) => c.nombre);
}

/**
 * Match parcial, insensible a mayúsculas y a tildes — quien pregunta puede escribir solo parte
 * del nombre, y no siempre con los mismos acentos que están cargados en el sistema (esto importa
 * especialmente cuando quien busca es un LLM, no una persona tipeando sobre un dato que ve en pantalla).
 * Extraído de ResponderConsultaDJService para reusarlo también desde la herramienta MCP
 * `buscar_docente_por_nombre` (backend/infrastructure/mcp/DjMcpServer.ts).
 *
 * Si no hay ninguna coincidencia, el NotFoundError lleva `context.sugerencias` con los nombres más
 * parecidos (si los hay) — la herramienta MCP los reenvía tal cual al modelo, que puede ofrecerlos
 * en vez de simplemente reportar el error.
 */
export async function buscarDocentePorNombre(
  usuarios: IUsuarioRepository,
  nombreConsultado: string
): Promise<Usuario> {
  const todos = await usuarios.listar();
  const query = normalizar(nombreConsultado.trim());
  const coincidencias = todos.filter((u) => normalizar(u.nombreCompleto).includes(query));

  if (coincidencias.length === 0) {
    const sugerencias = sugerirNombresSimilares(todos, query);
    throw new NotFoundError('DOCENTE_NOT_FOUND', sugerencias.length > 0 ? { sugerencias } : undefined);
  }
  if (coincidencias.length > 1) {
    throw new ValidationError('DOCENTE_AMBIGUO', {
      candidatos: coincidencias.map((u) => u.nombreCompleto),
    });
  }
  return coincidencias[0];
}
