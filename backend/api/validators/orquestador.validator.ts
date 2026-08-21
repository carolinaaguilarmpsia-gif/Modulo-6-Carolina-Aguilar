import { z } from 'zod';

export const AtenderOrquestadorSchema = z.object({
  conversacionId: z.string().trim().min(1).optional(),
  mensaje: z.string().trim().min(2, 'Escriba su mensaje').max(500),
});
