import rateLimit from 'express-rate-limit';

/**
 * Defensa adicional a nivel de aplicación en POST /auth/login — complementa
 * (no reemplaza) el rate limiting de Nginx descrito en DTI vFinal §13.1.
 * @see docs/SKILLS/auth-rbac-guard.md
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS', message: 'Demasiados intentos de login. Intente más tarde.' },
});
