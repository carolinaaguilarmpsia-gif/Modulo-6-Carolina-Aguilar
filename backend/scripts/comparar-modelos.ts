import { resolve } from 'node:path';
import { DeclaracionJuradaService } from '../domain/declaracion-jurada/services/DeclaracionJuradaService.js';
import { SugerirTipoDJService, type SugerirTipoDJInput } from '../domain/asistente-ia/services/SugerirTipoDJService.js';
import type { ILlmClient } from '../domain/asistente-ia/ports/out/ILlmClient.js';
import { ConsoleNotificacionPublisher } from '../infrastructure/notifications/ConsoleNotificacionPublisher.js';
import { InMemoryDeclaracionJuradaRepository } from '../infrastructure/persistence/InMemoryDeclaracionJuradaRepository.js';
import { OllamaClient } from '../infrastructure/ai/OllamaClient.js';
import { GroqClient } from '../infrastructure/ai/GroqClient.js';
import { loadEnvFile } from '../infrastructure/config/loadEnv.js';

loadEnvFile(resolve(process.cwd(), 'backend/.env'));

interface ResultadoComparacion {
  nombre: string;
  prompt: string;
  respuestaModelo: string;
  ms: number;
}

async function ejecutarYMedir(
  nombre: string,
  cliente: ILlmClient,
  input: SugerirTipoDJInput
): Promise<ResultadoComparacion> {
  const asistente = new SugerirTipoDJService(cliente);
  const inicio = performance.now();
  const resultado = await asistente.sugerir(input);
  const ms = Math.round(performance.now() - inicio);
  return { nombre, ...resultado, ms };
}

/**
 * Bonus "comparar dos modelos": mismo prompt (armado con el mismo dato real de una DJ),
 * enviado a un modelo local (Ollama) y a un modelo en la nube (Groq, tier gratis).
 * Ejecutar desde la raíz del repo: npx tsx backend/scripts/comparar-modelos.ts
 */
async function main(): Promise<void> {
  const djRepo = new InMemoryDeclaracionJuradaRepository();
  const djService = new DeclaracionJuradaService(djRepo, new ConsoleNotificacionPublisher());

  const dj = await djService.crear({
    docenteId: 'docente-demo-001',
    facultadId: 'facultad-demo-001',
    docenteVinculacionActiva: true,
    tipo: 'LABORAL',
    periodoAcademico: '2026-I',
    camposFormulario: {
      cargoInstitucional: 'Docente Titular — Facultad de Ciencias y Tecnología',
      dependencia: 'Facultad de Ciencias y Tecnología',
      actividadesDescripcion:
        'Además de mis cátedras e investigación del semestre, recibí un ingreso por la venta de un terreno familiar.',
      declaracionVeracidad: true,
    },
  });

  console.log('=== Declaración Jurada real (mismo dato para ambos modelos) ===');
  console.log(JSON.stringify({ id: dj.id, tipo: dj.tipo, camposFormulario: dj.camposFormulario }, null, 2));

  const campos = dj.camposFormulario as { cargoInstitucional: string; actividadesDescripcion: string };
  const input: SugerirTipoDJInput = {
    tipoDeclarado: dj.tipo,
    cargoInstitucional: campos.cargoInstitucional,
    actividadesDescripcion: campos.actividadesDescripcion,
  };

  const resultados: ResultadoComparacion[] = [];
  resultados.push(await ejecutarYMedir('llama3.2:3b — Ollama (local)', new OllamaClient(), input));
  resultados.push(await ejecutarYMedir('llama-3.1-8b-instant — Groq (nube, tier gratis)', new GroqClient(), input));

  console.log('\n=== Prompt enviado (idéntico para ambos modelos) ===');
  console.log(resultados[0].prompt);

  for (const r of resultados) {
    console.log(`\n=== ${r.nombre} — ${r.ms} ms ===`);
    console.log(r.respuestaModelo);
  }

  console.log('\n=== Comparación ===');
  for (const r of resultados) {
    console.log(`${r.nombre.padEnd(45)} ${r.ms} ms`);
  }
}

main().catch((err) => {
  console.error('Error ejecutando la comparación de modelos:', err);
  process.exitCode = 1;
});
