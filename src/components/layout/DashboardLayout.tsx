import type { ReactNode } from 'react';

import { DashboardShell } from '@/components/layout/DashboardShell';
import { appsData, tenantsData } from '@/mocks/platform-data';
import { requireCurrentSession } from '@/lib/session';
import { getAccessibleApps, getAccessibleTenants } from '@/lib/scope';

export async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireCurrentSession();
  const activeTenant = tenantsData.find((tenant) => tenant.id === session.user.tenantId) ?? null;
  const activeApp = appsData.find((app) => app.id === session.user.appId) ?? null;
  const tenantOptions = getAccessibleTenants(session.user, tenantsData);
  const appOptions = getAccessibleApps(session.user, session.user.tenantId, appsData);

  return (
    <DashboardShell
      sessionUser={session.user}
      activeTenant={activeTenant}
      activeApp={activeApp}
      tenantOptions={tenantOptions}
      appOptions={appOptions}
    >
      {children}
    </DashboardShell>
  );
}
