import { DeclaracionJuradaService } from '../domain/declaracion-jurada/services/DeclaracionJuradaService.js';
import { SugerirTipoDJService } from '../domain/asistente-ia/services/SugerirTipoDJService.js';
import { ConsoleNotificacionPublisher } from '../infrastructure/notifications/ConsoleNotificacionPublisher.js';
import { InMemoryDeclaracionJuradaRepository } from '../infrastructure/persistence/InMemoryDeclaracionJuradaRepository.js';
import { OllamaClient } from '../infrastructure/ai/OllamaClient.js';

/**
 * Demo "peldaño 0": integrar una llamada a un modelo de lenguaje dentro del proyecto,
 * sin pasar por un chat web. El prompt sale de un dato real de la app (una Declaración
 * Jurada recién creada con el mismo servicio de dominio que usa la API).
 *
 * Requiere Ollama corriendo localmente (app nativa, no Docker) con el modelo descargado:
 *   ollama serve            # ya corre como servicio de la app Ollama.app
 *   ollama pull llama3.2:3b
 *
 * Ejecutar desde la raíz del repo:
 *   npx tsx backend/scripts/demo-llm.ts
 */
async function main(): Promise<void> {
  // 1) Dato real de la app: se crea una DJ con el mismo DeclaracionJuradaService que usa la API.
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

  console.log('=== 1) Declaración Jurada real, creada con DeclaracionJuradaService ===');
  console.log(JSON.stringify({ id: dj.id, tipo: dj.tipo, camposFormulario: dj.camposFormulario }, null, 2));

  // 2) Peldaño 0: función que arma un prompt con ese dato real y lo manda al modelo.
  const llm = new OllamaClient();
  const asistente = new SugerirTipoDJService(llm);
  const campos = dj.camposFormulario as { cargoInstitucional: string; actividadesDescripcion: string };

  const resultado = await asistente.sugerir({
    tipoDeclarado: dj.tipo,
    cargoInstitucional: campos.cargoInstitucional,
    actividadesDescripcion: campos.actividadesDescripcion,
  });

  console.log('\n=== 2) Prompt enviado a llama3.2:3b (Ollama local, http://localhost:11434) ===');
  console.log(resultado.prompt);

  console.log('\n=== 3) Respuesta real del modelo ===');
  console.log(resultado.respuestaModelo);
}

main().catch((err) => {
  console.error('Error ejecutando la demo de IA:', err);
  process.exitCode = 1;
});
