import { describe, expect, it } from 'vitest';

import { buildClientErrorFingerprint, shouldReportClientError } from '@/lib/client-error-reporting';

describe('client error reporting', () => {
  it('builds stable fingerprints from route and message context', () => {
    expect(
      buildClientErrorFingerprint({
        kind: 'boundary',
        source: 'root-error-boundary',
        pathname: '/agents?view=board',
        message: 'Boom',
      }),
    ).toBe('boundary::root-error-boundary::/agents?view=board::Boom');
  });

  it('deduplicates repeated reports inside the configured TTL', () => {
    const cache = new Map<string, number>();
    const fingerprint = 'boundary::root::/::Boom';

    expect(shouldReportClientError(fingerprint, { now: 1000, ttlMs: 5000, cache })).toBe(true);
    expect(shouldReportClientError(fingerprint, { now: 3000, ttlMs: 5000, cache })).toBe(false);
    expect(shouldReportClientError(fingerprint, { now: 7001, ttlMs: 5000, cache })).toBe(true);
  });
});