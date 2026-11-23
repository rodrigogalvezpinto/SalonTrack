export interface RateLimitResult {
  limited: boolean;
  retryAfterSec: number;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  maxEntries?: number;
}

interface WindowEntry {
  startedAt: number;
  count: number;
}

export interface RateLimiter {
  hit(key: string): RateLimitResult;
  check(key: string): RateLimitResult;
  reset(key: string): void;
  size(): number;
}

const limitStates = new Set<Map<string, WindowEntry>>();

export function createRateLimiter({ windowMs, max, maxEntries = 10_000 }: RateLimitOptions): RateLimiter {
  if (
    !Number.isFinite(windowMs) ||
    windowMs <= 0 ||
    !Number.isInteger(max) ||
    max <= 0 ||
    !Number.isInteger(maxEntries) ||
    maxEntries <= 0
  ) {
    throw new RangeError('Rate limiter requires positive window, request, and entry limits.');
  }

  const entries = new Map<string, WindowEntry>();
  limitStates.add(entries);
  let lastSweepAt = Date.now();

  const isExpired = (entry: WindowEntry, now: number) => now - entry.startedAt >= windowMs;

  const sweepExpiredEntries = (now: number) => {
    if (now - lastSweepAt < windowMs) return;

    for (const [entryKey, entry] of entries) {
      if (isExpired(entry, now)) entries.delete(entryKey);
    }
    lastSweepAt = now;
  };

  const checkAt = (key: string, now: number): RateLimitResult => {
    const requestedEntry = entries.get(key);
    if (requestedEntry && isExpired(requestedEntry, now)) entries.delete(key);
    sweepExpiredEntries(now);

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
      else {
        if (entries.size >= maxEntries) {
          sweepExpiredEntries(now);
          while (entries.size >= maxEntries) {
            const oldestKey = entries.keys().next().value as string | undefined;
            if (oldestKey === undefined) break;
            entries.delete(oldestKey);
          }
        }
        entries.set(key, { startedAt: now, count: 1 });
      }
      return result;
    },
    check(key) {
      return checkAt(key, Date.now());
    },
    reset(key) {
      entries.delete(key);
    },
    size() {
      return entries.size;
    },
  };
}

export function resetRateLimits(): void {
  for (const entries of limitStates) {
    entries.clear();
  }
}
