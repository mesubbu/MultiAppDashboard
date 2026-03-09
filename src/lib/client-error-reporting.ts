export type ClientErrorKind = 'boundary' | 'window-error' | 'unhandledrejection';

export interface ClientErrorReportInput {
  kind: ClientErrorKind;
  source: string;
  message: string;
  name?: string;
  stack?: string;
  pathname?: string;
  componentStack?: string;
  digest?: string;
}

const recentFingerprints = new Map<string, number>();
const DEFAULT_TTL_MS = 15_000;

export function buildClientErrorFingerprint(input: Pick<ClientErrorReportInput, 'kind' | 'source' | 'message' | 'pathname'>) {
  return [input.kind, input.source, input.pathname ?? '', input.message].join('::');
}

export function shouldReportClientError(
  fingerprint: string,
  options: { now?: number; ttlMs?: number; cache?: Map<string, number> } = {},
) {
  const now = options.now ?? Date.now();
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const cache = options.cache ?? recentFingerprints;

  for (const [cachedFingerprint, timestamp] of cache.entries()) {
    if (now - timestamp > ttlMs) {
      cache.delete(cachedFingerprint);
    }
  }

  const previousTimestamp = cache.get(fingerprint);
  if (previousTimestamp && now - previousTimestamp <= ttlMs) {
    return false;
  }

  cache.set(fingerprint, now);
  return true;
}

export async function reportClientError(input: ClientErrorReportInput) {
  if (typeof window === 'undefined') {
    return;
  }

  const payload = {
    ...input,
    pathname: input.pathname ?? `${window.location.pathname}${window.location.search}`,
    userAgent: window.navigator.userAgent,
  };

  const fingerprint = buildClientErrorFingerprint(payload);
  if (!shouldReportClientError(fingerprint)) {
    return;
  }

  const body = JSON.stringify(payload);

  try {
    if (typeof navigator.sendBeacon === 'function') {
      const accepted = navigator.sendBeacon(
        '/api/observability/client-errors',
        new Blob([body], { type: 'application/json' }),
      );
      if (accepted) {
        return;
      }
    }

    await fetch('/api/observability/client-errors', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch {
    // Avoid surfacing secondary failures while attempting to report the original error.
  }
}
