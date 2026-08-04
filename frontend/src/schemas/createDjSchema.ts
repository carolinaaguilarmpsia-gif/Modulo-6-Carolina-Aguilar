import { z } from 'zod';

/** Período académico CEUB — formato 2026-I | 2026-II */
const periodoAcademicoRegex = /^\d{4}-(I|II)$/;

export const TIPOS_DJ = [
  { value: 'LABORAL', label: 'Declaración Jurada Laboral' },
  { value: 'PATRIMONIAL', label: 'Declaración Jurada Patrimonial' },
  { value: 'INTERESES', label: 'Declaración de Intereses' },
] as const;

export type TipoDJ = (typeof TIPOS_DJ)[number]['value'];

/** Facultades de la Universidad Mayor de San Simón (UMSS) */
export const FACULTADES_UMSS = [
  'Facultad de Arquitectura y Ciencias del Hábitat',
  'Facultad de Ciencias Agrícolas y Pecuarias',
  'Facultad de Ciencias Económicas',
  'Facultad de Ciencias Farmacéuticas y Bioquímicas',
  'Facultad de Ciencias Jurídicas y Políticas',
  'Facultad de Ciencias y Tecnología',
  'Facultad de Desarrollo Rural y Territorial',
  'Facultad de Humanidades y Ciencias de la Educación',
  'Facultad de Medicina "Aurelio Melean"',
  'Facultad de Odontología',
  'Facultad Politécnica',
] as const satisfies readonly [string, ...string[]];

export type FacultadUMSS = (typeof FACULTADES_UMSS)[number];

/**
 * Esquema Zod — FSD §6.2 + POST /api/v1/declaraciones-juradas
 * @see wireframe_dj_nueva.png → /declaraciones-juradas/nueva
 */
export const createDjFormSchema = z.object({
  tipo: z.enum(['LABORAL', 'PATRIMONIAL', 'INTERESES'], {
    required_error: 'Seleccione el tipo de declaración jurada',
  }),
  periodoAcademico: z
    .string()
    .min(1, 'El período académico es obligatorio')
    .regex(periodoAcademicoRegex, 'Use el formato 2026-I o 2026-II'),
  cargoInstitucional: z
    .string()
    .trim()
    .min(3, 'Indique su cargo institucional (mínimo 3 caracteres)')
    .max(120, 'Máximo 120 caracteres'),
  dependencia: z.enum(FACULTADES_UMSS, {
    required_error: 'Seleccione su facultad',
    invalid_type_error: 'Seleccione una facultad válida de la UMSS',
  }),
  actividadesDescripcion: z
    .string()
    .trim()
    .min(20, 'Describa sus actividades (mínimo 20 caracteres)')
    .max(2000, 'Máximo 2000 caracteres'),
  referenciaDocumental: z
    .string()
    .trim()
    .max(500, 'Máximo 500 caracteres')
    .optional()
    .or(z.literal('')),
  declaracionVeracidad: z
    .boolean()
    .refine((v) => v === true, {
      message: 'Debe declarar bajo fe que la información es verídica',
    }),
});

export type CreateDjFormValues = z.infer<typeof createDjFormSchema>;

export function formValuesToPayload(values: CreateDjFormValues) {
  return {
    tipo: values.tipo,
    periodoAcademico: values.periodoAcademico,
    camposFormulario: {
      cargoInstitucional: values.cargoInstitucional,
      dependencia: values.dependencia,
      actividadesDescripcion: values.actividadesDescripcion,
      referenciaDocumental: values.referenciaDocumental || undefined,
      declaracionVeracidad: values.declaracionVeracidad,
    },
  };
}

const PREFIJO_TIPO: Record<TipoDJ, string> = {
  LABORAL: 'LAB',
  PATRIMONIAL: 'PAT',
  INTERESES: 'INT',
};

/**
 * Código de referencia documental — autogenerado, el docente no lo escribe a mano.
 * Formato: EXP-{tipo}-{periodoAcademico}-{4 dígitos aleatorios}, p. ej. EXP-LAB-2026-I-0472.
 */
export function generarCodigoReferencia(tipo: TipoDJ, periodoAcademico: string): string {
  const sufijo = Math.floor(1000 + Math.random() * 9000);
  const periodo = periodoAcademico || 'XXXX';
  return `EXP-${PREFIJO_TIPO[tipo]}-${periodo}-${sufijo}`;
}

/** RB-03 — estados donde el formulario no es editable (client-side guard) */
export const ESTADOS_DJ_NO_EDITABLES = [
  'APROBADA',
  'EN_REVISION_FACULTAD',
  'EN_REVISION_DPA',
] as const;
