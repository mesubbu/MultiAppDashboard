'use client';

import { Bell, LogOut, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';

import type { AppRecord, SessionUser, TenantRecord } from '@/types/platform';

export function Topbar({
  sessionUser,
  activeTenant,
  activeApp,
}: {
  sessionUser: SessionUser;
  activeTenant: TenantRecord | null;
  activeApp: AppRecord | null;
}) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm text-slate-400">Authenticated as</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold text-white">{sessionUser.name}</span>
          {sessionUser.roles.map((role) => (
            <span key={role} className="inline-flex items-center rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-300 ring-1 ring-cyan-500/20">
              <Shield className="mr-1 h-3 w-3" />
              {role.replaceAll('_', ' ')}
            </span>
          ))}
          {activeTenant ? (
            <span className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200 ring-1 ring-white/10">
              {activeTenant.name} · {activeTenant.tier}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200 ring-1 ring-white/10">
              Platform-wide view
            </span>
          )}
          {activeApp ? (
            <span className="inline-flex items-center rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-200 ring-1 ring-violet-500/20">
              {activeApp.name}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {sessionUser.tenantId} · {sessionUser.appId} · {sessionUser.email}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div
          role="status"
          aria-live="polite"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300"
        >
          <Bell className="h-4 w-4" />
          3 live alerts
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
