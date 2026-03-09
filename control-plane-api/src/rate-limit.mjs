import { HttpError } from './http.mjs';

function buildHeaders(entry, limit) {
  const resetSeconds = Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000));
  return {
    'x-ratelimit-limit': `${limit}`,
    'x-ratelimit-remaining': `${Math.max(0, limit - entry.count)}`,
    'x-ratelimit-reset': `${resetSeconds}`,
    'retry-after': `${resetSeconds}`,
  };
}

export function createRateLimiter() {
  const buckets = new Map();

  return {
    check(key, limit, windowMs) {
      const now = Date.now();
      const current = buckets.get(key);
      const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
      entry.count += 1;
      buckets.set(key, entry);

      if (entry.count > limit) {
        throw new HttpError(429, 'RATE_LIMITED', 'Too many requests. Please retry after the cooldown period.', undefined, buildHeaders(entry, limit));
      }

      return buildHeaders(entry, limit);
    },
  };
}

export function resolveRateLimit(route, method) {
  if (route.path === '/admin/events/stream') {
    return { limit: 10, windowMs: 60_000 };
  }
  if (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
    return { limit: 20, windowMs: 60_000 };
  }
  return { limit: 120, windowMs: 60_000 };
}