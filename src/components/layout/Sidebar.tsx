'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Bot,
  Brain,
  Building2,
  DatabaseZap,
  GitBranchPlus,
  LayoutGrid,
  Network,
  Radar,
  Settings,
  ShieldCheck,
  ToolCase,
  Users,
} from 'lucide-react';

import { canAccessModule } from '@/lib/rbac';
import type { AppScopeOption, TenantScopeOption } from '@/lib/scope';
import { dashboardModules } from '@/modules/dashboard/catalog';
import type { SessionUser } from '@/types/platform';
import { TenantSwitcher } from '@/components/layout/TenantSwitcher';
import { cn } from '@/lib/utils';

const iconMap = {
  overview: LayoutGrid,
  tenants: Building2,
  apps: ShieldCheck,
  users: Users,
  agents: Bot,
  tools: ToolCase,
  models: Brain,
  memory: DatabaseZap,
  'knowledge-graph': Network,
  events: Activity,
  analytics: Radar,
  observability: GitBranchPlus,
  audit: ShieldCheck,
  settings: Settings,
} as const;

export function Sidebar({
  sessionUser,
  tenantOptions,
  appOptions,
}: {
  sessionUser: SessionUser;
  tenantOptions: TenantScopeOption[];
  appOptions: AppScopeOption[];
}) {
  const pathname = usePathname();
  const visibleModules = dashboardModules.filter((module) =>
    canAccessModule(sessionUser.roles, module),
  );

  return (
    <aside aria-label="Dashboard sidebar" className="hidden h-screen w-72 shrink-0 border-r border-white/10 bg-slate-950/90 px-5 py-6 lg:block">
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Multi-tenant</p>
        <h2 className="mt-2 text-xl font-semibold text-white">AI Platform Control</h2>
        <p className="mt-2 text-sm text-slate-400">Edge-aware, tenant-scoped, orchestration-first admin surface.</p>
      </div>
      <TenantSwitcher
        key={`${sessionUser.tenantId}:${sessionUser.appId}`}
        activeTenantId={sessionUser.tenantId}
        activeAppId={sessionUser.appId}
        tenantOptions={tenantOptions}
        appOptions={appOptions}
      />
      <nav aria-label="Primary dashboard navigation" className="mt-6 space-y-2">
        {visibleModules.map((module) => {
          const Icon = iconMap[module.slug as keyof typeof iconMap] ?? LayoutGrid;
          const href = (module.slug === 'overview' ? '/' : `/${module.slug}`) as Route;
          const isCurrentPage = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={module.slug}
              href={href}
              aria-current={isCurrentPage ? 'page' : undefined}
              className={cn(
                'flex items-start gap-3 rounded-xl px-3 py-3 text-slate-300 transition hover:bg-white/5 hover:text-white',
                isCurrentPage && 'bg-cyan-400/10 text-white ring-1 ring-cyan-400/30',
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 text-cyan-300" aria-hidden="true" />
              <span>
                <span className="block text-sm font-medium">{module.title}</span>
                <span className="mt-1 block text-xs text-slate-500">{module.description}</span>
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
