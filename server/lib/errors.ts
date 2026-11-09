import type { NextFunction, Request, Response, RequestHandler } from 'express';

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'APP_ERROR',
    public details?: unknown
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, message, 'BAD_REQUEST', details);
export const unauthorized = (message = 'No autorizado.') => new AppError(401, message, 'UNAUTHORIZED');
export const forbidden = (message = 'No tienes permisos para esta operación.') => new AppError(403, message, 'FORBIDDEN');
export const notFound = (message = 'Recurso no encontrado.') => new AppError(404, message, 'NOT_FOUND');
export const conflict = (message: string) => new AppError(409, message, 'CONFLICT');
export const tooManyRequests = (message = 'Demasiados intentos. Espera unos minutos e inténtalo nuevamente.') =>
  new AppError(429, message, 'TOO_MANY_REQUESTS');

export function asyncHandler(fn: (req: any, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function notFoundApiHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`, code: 'NOT_FOUND' });
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, code: err.code, ...(err.details ? { details: err.details } : {}) });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la solicitud no es un JSON válido.', code: 'BAD_REQUEST' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'La solicitud excede el tamaño permitido.', code: 'PAYLOAD_TOO_LARGE' });
  }
  if (typeof err?.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT')) {
    const status = err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ? 409 : 400;
    return res.status(status).json({ error: 'La operación viola una restricción de integridad de datos.', code: err.code });
  }
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);
  return res.status(500).json({ error: 'Error interno del servidor.', code: 'INTERNAL_ERROR' });
}
