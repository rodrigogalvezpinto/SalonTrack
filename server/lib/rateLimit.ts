import type { Request, Response, NextFunction } from 'express';
import { tooManyRequests } from './errors.js';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Limitador en memoria de ventana fija, suficiente para un único proceso local. */
export function rateLimit(options: { name: string; windowMs: number; max: number; key?: (req: Request) => string }) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const now = Date.now();
    const id = `${options.name}:${options.key ? options.key(req) : req.ip}`;
    let bucket = buckets.get(id);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(id, bucket);
    }
    bucket.count++;
    if (bucket.count > options.max) return next(tooManyRequests());
    next();
  };
}

export function resetRateLimits() {
  buckets.clear();
}
