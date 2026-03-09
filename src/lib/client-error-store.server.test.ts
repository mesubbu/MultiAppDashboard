import { afterEach, describe, expect, it } from 'vitest';

import { listRecentClientErrors, recordRecentClientError } from '@/lib/client-error-store.server';
import type { ClientErrorRecord, SessionUser } from '@/types/platform';

afterEach(() => {
  globalThis.__dashboardRecentClientErrors = undefined;
});

const user: SessionUser = {
  userId: 'user_1', tenantId: 'tenant_acme', appId: 'app_market_web', name: 'Owner', email: 'owner@platform.local', roles: ['tenant_admin'],
};

function buildError(index: number, overrides: Partial<ClientErrorRecord> = {}): ClientErrorRecord {
  return {
    id: `err_${index}`,
    kind: 'window-error',
    source: 'ui',
    message: `Error ${index}`,
    name: 'Error',
    pathname: '/',
    digest: null,
    occurredAt: '2026-03-09T00:00:00.000Z',
    tenantId: 'tenant_acme',
    appId: 'app_market_web',
    userId: 'user_1',
    ...overrides,
  };
}

describe('client-error-store.server', () => {
  it('stores cloned client errors and retains only the 50 most recent', () => {
    for (let index = 0; index < 55; index += 1) {
      recordRecentClientError(buildError(index));
    }

    const original = buildError(999, { message: 'Original message' });
    recordRecentClientError(original);
    original.message = 'mutated after record';

    const items = listRecentClientErrors(user);
    expect(items).toHaveLength(50);
    expect(items[0]?.id).toBe('err_999');
    expect(items[0]?.message).toBe('Original message');
    expect(items.at(-1)?.id).toBe('err_6');
  });

  it('filters recent errors to the current tenant and app scope', () => {
    recordRecentClientError(buildError(1));
    recordRecentClientError(buildError(2, { appId: 'app_other' }));
    recordRecentClientError(buildError(3, { tenantId: 'tenant_other' }));

    expect(listRecentClientErrors(user).map((item) => item.id)).toEqual(['err_1']);
  });
});

