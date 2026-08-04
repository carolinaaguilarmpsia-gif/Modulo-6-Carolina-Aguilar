import type { NextFunction, Request, Response } from 'express';

/**
 * Express 4 no reenvía rechazos de promesas a `globalErrorHandler` automáticamente.
 * Envuelve handlers async para que cualquier rechazo llegue a `next` y sea manejado ahí.
 * También permite tipar `req` como `AuthenticatedRequest & { validatedBody: ... }` sin que
 * `router.get/post/patch` (que esperan `RequestHandler<Request>`) rompan el chequeo de tipos.
 */
export function asyncHandler<Req extends Request = Request>(fn: (req: Req, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req as Req, res).catch(next);
  };
}
