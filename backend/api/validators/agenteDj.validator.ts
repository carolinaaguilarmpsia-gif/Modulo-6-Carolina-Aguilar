import { z } from 'zod';

export const PreguntarAgenteDjSchema = z.object({
  pregunta: z.string().trim().min(3, 'Escriba su pregunta').max(500),
});

export const ConfirmarAgenteDjSchema = z.object({
  sessionId: z.string().trim().min(1, 'Falta el sessionId'),
  confirmar: z.boolean(),
});
