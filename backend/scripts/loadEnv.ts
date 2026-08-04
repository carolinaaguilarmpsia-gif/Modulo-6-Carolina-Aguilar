import { existsSync, readFileSync } from 'node:fs';

/**
 * Parser mínimo de .env para los scripts de demo — sin agregar `dotenv` como dependencia.
 * No sobrescribe variables ya presentes en el entorno (una var exportada en la shell gana).
 */
export function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;

  const contenido = readFileSync(path, 'utf-8');

  for (const linea of contenido.split('\n')) {
    const sinComentario = linea.trim();
    if (!sinComentario || sinComentario.startsWith('#')) continue;

    const match = sinComentario.match(/^([\w.-]+)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}
