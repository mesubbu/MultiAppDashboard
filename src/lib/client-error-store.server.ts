import type { ClientErrorRecord, SessionUser } from '@/types/platform';

import { getScopeFilters } from '@/lib/scope';

declare global {
  var __dashboardRecentClientErrors: ClientErrorRecord[] | undefined;
}

function getStore() {
  globalThis.__dashboardRecentClientErrors ??= [];
  return globalThis.__dashboardRecentClientErrors;
}

export function recordRecentClientError(error: ClientErrorRecord) {
  const store = getStore();
  store.unshift(structuredClone(error));
  if (store.length > 50) {
    store.splice(50);
  }
}

export function listRecentClientErrors(user: SessionUser) {
  const scope = getScopeFilters(user);
  return getStore().filter(
    (item) => (!scope.tenantId || item.tenantId === scope.tenantId) && (!scope.appId || item.appId === scope.appId),
  );
}
