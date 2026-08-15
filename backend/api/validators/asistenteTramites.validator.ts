import { z } from 'zod';

export const AsistenteTramitesSchema = z.object({
  pregunta: z.string().trim().min(3, 'Escriba su pregunta').max(300),
});
