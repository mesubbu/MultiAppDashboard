'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';

import { AssistantSidebar } from '@/components/layout/AssistantSidebar';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import type { AppRecord, TenantRecord } from '@/types/platform';
import type { AppScopeOption, TenantScopeOption } from '@/lib/scope';
import type { SessionUser } from '@/types/platform';

interface DashboardShellProps {
  sessionUser: SessionUser;
  activeTenant: TenantRecord | null;
  activeApp: AppRecord | null;
  tenantOptions: TenantScopeOption[];
  appOptions: AppScopeOption[];
  children: ReactNode;
}

export function DashboardShell({
  sessionUser,
  activeTenant,
  activeApp,
  tenantOptions,
  appOptions,
  children,
}: DashboardShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] text-white">
      <a href="#dashboard-main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Mobile sidebar overlay */}
      {isMobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setIsMobileNavOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto border-r border-white/10 bg-slate-950 shadow-2xl">
            <Sidebar sessionUser={sessionUser} tenantOptions={tenantOptions} appOptions={appOptions} />
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex min-h-screen max-w-[1800px]">
        <Sidebar sessionUser={sessionUser} tenantOptions={tenantOptions} appOptions={appOptions} />
        <main id="dashboard-main-content" tabIndex={-1} className="min-w-0 flex-1 px-4 py-4 focus:outline-none md:px-8">
          <Topbar
            sessionUser={sessionUser}
            activeTenant={activeTenant}
            activeApp={activeApp}
            onMenuToggle={() => setIsMobileNavOpen(true)}
          />
          <div className="mt-6 space-y-6">{children}</div>
        </main>
        <AssistantSidebar sessionUser={sessionUser} />
      </div>
    </div>
  );
}
