import type { DeclaracionJurada } from '../../domain/declaracion-jurada/entities/DeclaracionJurada.js';
import { EstadoDJ } from '../../domain/declaracion-jurada/types/EstadoDJ.js';
import {
  DOCENTE_JUAN_JALDIN_ID,
  DOCENTE_MARIA_ROJAS_ID,
  DOCENTE_PEDRO_FERNANDEZ_ID,
  FACULTAD_ECONOMICAS_ID,
  FACULTAD_ECONOMICAS_NOMBRE,
  FACULTAD_TECNOLOGIA_ID,
  FACULTAD_TECNOLOGIA_NOMBRE,
} from './seedIds.js';

function campos(dependencia: string, cargoInstitucional: string, actividadesDescripcion: string): Record<string, unknown> {
  return {
    dependencia,
    cargoInstitucional,
    actividadesDescripcion,
    declaracionVeracidad: true,
  };
}

/**
 * DJ semilla — cubren los 3 escenarios de aprobación que ejercita la demo del agente MCP:
 * un docente con exactamente 1 DJ (Juan Jaldín), un docente con más de 1 (María Rojas) y un
 * docente sin ninguna (Andrea Quispe — no aparece acá, justamente porque no tiene DJ). Pedro
 * Fernández cubre el caso "docente en 2 facultades": una DJ por facultad, cada una pendiente
 * del Admin. Facultad que corresponde según RB de "misma facultad".
 * @see InMemoryUsuarioRepository.ts — usuarios a los que pertenecen estas DJ
 * @see DjMcpServer.ts / AgenteDJService.ts — el agente las lee y propone transiciones sobre ellas
 */
export function declaracionesJuradasSemilla(): DeclaracionJurada[] {
  const ahora = new Date();
  const haceUnaSemana = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const gestionPasada = new Date('2025-08-10T09:00:00Z');

  return [
    {
      id: 'dj-jaldin-2026-i',
      docenteId: DOCENTE_JUAN_JALDIN_ID,
      facultadId: FACULTAD_ECONOMICAS_ID,
      estado: EstadoDJ.EN_REVISION_FACULTAD,
      docenteVinculacionActiva: true,
      tipo: 'LABORAL',
      periodoAcademico: '2026-I',
      camposFormulario: campos(
        FACULTAD_ECONOMICAS_NOMBRE,
        'Docente Titular — Economía',
        'Dicta las materias de Microeconomía I y Macroeconomía II, carga horaria de 20 horas/semana.'
      ),
      createdAt: haceUnaSemana,
      updatedAt: haceUnaSemana,
    },
    {
      id: 'dj-rojas-2025-ii',
      docenteId: DOCENTE_MARIA_ROJAS_ID,
      facultadId: FACULTAD_ECONOMICAS_ID,
      estado: EstadoDJ.APROBADA,
      docenteVinculacionActiva: true,
      tipo: 'LABORAL',
      periodoAcademico: '2025-II',
      camposFormulario: campos(
        FACULTAD_ECONOMICAS_NOMBRE,
        'Docente Asociada — Contaduría Pública',
        'Dictó Contabilidad Financiera I, grupo A y B, 16 horas/semana durante la gestión 2025-II.'
      ),
      createdAt: gestionPasada,
      updatedAt: gestionPasada,
    },
    {
      id: 'dj-rojas-2026-i',
      docenteId: DOCENTE_MARIA_ROJAS_ID,
      facultadId: FACULTAD_ECONOMICAS_ID,
      estado: EstadoDJ.EN_REVISION_FACULTAD,
      docenteVinculacionActiva: true,
      tipo: 'LABORAL',
      periodoAcademico: '2026-I',
      camposFormulario: campos(
        FACULTAD_ECONOMICAS_NOMBRE,
        'Docente Asociada — Contaduría Pública',
        'Continúa en Contabilidad Financiera I y se suma como responsable de Auditoría I, 18 horas/semana.'
      ),
      createdAt: haceUnaSemana,
      updatedAt: haceUnaSemana,
    },
    {
      // Escenario "2 facultades" — parte 1: la DJ que revisa el Admin. Facultad Económicas.
      id: 'dj-fernandez-economicas-2026-i',
      docenteId: DOCENTE_PEDRO_FERNANDEZ_ID,
      facultadId: FACULTAD_ECONOMICAS_ID,
      estado: EstadoDJ.EN_REVISION_FACULTAD,
      docenteVinculacionActiva: true,
      tipo: 'LABORAL',
      periodoAcademico: '2026-I',
      camposFormulario: campos(
        FACULTAD_ECONOMICAS_NOMBRE,
        'Docente Invitado — Estadística',
        'Dicta Estadística Aplicada I en la Facultad de Ciencias Económicas, 10 horas/semana.'
      ),
      createdAt: haceUnaSemana,
      updatedAt: haceUnaSemana,
    },
    {
      // Escenario "2 facultades" — parte 2: la misma persona, otra DJ, otra facultad — la
      // revisa el Admin. Facultad Tecnología, y el Admin. Facultad Económicas NO debe poder
      // tocarla (CROSS_FACULTY_FORBIDDEN en DJStateMachine).
      id: 'dj-fernandez-tecnologia-2026-i',
      docenteId: DOCENTE_PEDRO_FERNANDEZ_ID,
      facultadId: FACULTAD_TECNOLOGIA_ID,
      estado: EstadoDJ.EN_REVISION_FACULTAD,
      docenteVinculacionActiva: true,
      tipo: 'LABORAL',
      periodoAcademico: '2026-I',
      camposFormulario: campos(
        FACULTAD_TECNOLOGIA_NOMBRE,
        'Docente Invitado — Estadística',
        'Dicta Estadística Aplicada II en la Facultad de Ciencias y Tecnología, 8 horas/semana.'
      ),
      createdAt: haceUnaSemana,
      updatedAt: haceUnaSemana,
    },
  ];
}
