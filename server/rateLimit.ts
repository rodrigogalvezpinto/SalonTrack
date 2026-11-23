export interface RateLimitResult {
  limited: boolean;
  retryAfterSec: number;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

interface WindowEntry {
  startedAt: number;
  count: number;
}

export interface RateLimiter {
  hit(key: string): RateLimitResult;
  check(key: string): RateLimitResult;
  reset(key: string): void;
}

const limitStates = new Set<Map<string, WindowEntry>>();

export function createRateLimiter({ windowMs, max }: RateLimitOptions): RateLimiter {
  if (!Number.isFinite(windowMs) || windowMs <= 0 || !Number.isInteger(max) || max <= 0) {
    throw new RangeError('Rate limiter requires a positive window and a positive integer maximum.');
  }

  const entries = new Map<string, WindowEntry>();
  limitStates.add(entries);

  const checkAt = (key: string, now: number): RateLimitResult => {
    for (const [entryKey, entry] of entries) {
      if (now - entry.startedAt >= windowMs) {
        entries.delete(entryKey);
      }
    }

    const entry = entries.get(key);
    if (!entry || entry.count < max) {
      return { limited: false, retryAfterSec: 0 };
    }

    return {
      limited: true,
      retryAfterSec: Math.max(1, Math.ceil((entry.startedAt + windowMs - now) / 1000)),
    };
  };

  return {
    hit(key) {
      const now = Date.now();
      const result = checkAt(key, now);
      if (result.limited) return result;

      const entry = entries.get(key);
      if (entry) entry.count += 1;
      else entries.set(key, { startedAt: now, count: 1 });
      return result;
    },
    check(key) {
      return checkAt(key, Date.now());
    },
    reset(key) {
      entries.delete(key);
    },
  };
}

export function resetRateLimits(): void {
  for (const entries of limitStates) {
    entries.clear();
  }
}
