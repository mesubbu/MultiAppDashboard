import type { ReactNode } from 'react';

import { AssistantSidebar } from '@/components/layout/AssistantSidebar';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] text-white">
      <a href="#dashboard-main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="mx-auto flex min-h-screen max-w-[1800px]">
        <Sidebar sessionUser={session.user} tenantOptions={tenantOptions} appOptions={appOptions} />
        <main id="dashboard-main-content" tabIndex={-1} className="min-w-0 flex-1 px-4 py-4 focus:outline-none md:px-8">
          <Topbar sessionUser={session.user} activeTenant={activeTenant} activeApp={activeApp} />
          <div className="mt-6 space-y-6">{children}</div>
        </main>
        <AssistantSidebar sessionUser={session.user} />
      </div>
    </div>
  );
}
