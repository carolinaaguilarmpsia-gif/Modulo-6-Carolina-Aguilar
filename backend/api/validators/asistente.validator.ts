import { z } from 'zod';

export const ValidarDJSchema = z.object({
  facultad: z.string().trim().min(3, 'Indique la facultad').max(150),
  nombreDocente: z.string().trim().min(2, 'Indique el nombre del docente').max(120),
  periodoAcademico: z
    .string()
    .regex(/^\d{4}-(I|II)$/, 'Use el formato 2026-I o 2026-II')
    .optional(),
  consulta: z.string().trim().min(3, 'Escriba su consulta').max(500),
});
