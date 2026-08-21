/**
 * Ids compartidos entre los datos semilla de usuarios (InMemoryUsuarioRepository) y de
 * declaraciones juradas (seedDeclaracionesJuradas) — centralizados acá para que ambos lados
 * de la semilla nunca se desincronicen (p. ej. un docenteId que exista en una DJ pero no en
 * usuarios, o una facultad con nombre distinto entre pantallas).
 */

export const FACULTAD_ECONOMICAS_ID = 'facultad-economicas';
export const FACULTAD_ECONOMICAS_NOMBRE = 'Facultad de Ciencias Económicas';

export const FACULTAD_TECNOLOGIA_ID = 'facultad-tecnologia';
export const FACULTAD_TECNOLOGIA_NOMBRE = 'Facultad de Ciencias y Tecnología';

export const DOCENTE_DEMO_ID = 'docente-demo-001';
export const DOCENTE_JUAN_JALDIN_ID = 'docente-juan-jaldin';
export const DOCENTE_CARLOS_PAZ_ID = 'docente-carlos-paz';
export const DOCENTE_MARIA_ROJAS_ID = 'docente-maria-rojas';
export const DOCENTE_ANDREA_QUISPE_ID = 'docente-andrea-quispe';
export const DOCENTE_PEDRO_FERNANDEZ_ID = 'docente-pedro-fernandez';
