'use client';

import { useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { AppScopeOption, TenantScopeOption } from '@/lib/scope';

export function TenantSwitcher({
  activeTenantId,
  activeAppId,
  tenantOptions,
  appOptions,
}: {
  activeTenantId: string;
  activeAppId: string;
  tenantOptions: TenantScopeOption[];
  appOptions: AppScopeOption[];
}) {
  const router = useRouter();
  const headingId = useId();
  const tenantSelectId = useId();
  const appSelectId = useId();
  const statusId = useId();
  const errorId = useId();
  const [isPending, startTransition] = useTransition();
  const [tenantId, setTenantId] = useState(activeTenantId);
  const [appId, setAppId] = useState(activeAppId);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function updateContext(payload: { tenantId?: string; appId?: string }) {
    setErrorMessage(null);
    const response = await fetch('/api/auth/context', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setErrorMessage(body?.error?.message ?? 'Unable to update the active tenant context.');
      return;
    }

    const body = (await response.json()) as { user?: { tenantId: string; appId: string } };
    if (body.user) {
      setTenantId(body.user.tenantId);
      setAppId(body.user.appId);
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <section aria-labelledby={headingId} className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
      <p id={headingId} className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
        Active context
      </p>
      <div className="mt-3 space-y-3">
        <div>
          <label htmlFor={tenantSelectId} className="block text-xs text-slate-400">
            Tenant scope
          </label>
          <select
            id={tenantSelectId}
            value={tenantId}
            disabled={isPending}
            onChange={(event) => {
              setTenantId(event.target.value);
              void updateContext({ tenantId: event.target.value });
            }}
            aria-describedby={errorMessage ? errorId : statusId}
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          >
            {tenantOptions.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={appSelectId} className="block text-xs text-slate-400">
            App scope
          </label>
          <select
            id={appSelectId}
            value={appId}
            disabled={isPending || appOptions.length <= 1}
            onChange={(event) => {
              setAppId(event.target.value);
              void updateContext({ tenantId, appId: event.target.value });
            }}
            aria-describedby={errorMessage ? errorId : statusId}
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          >
            {appOptions.map((app) => (
              <option key={app.id} value={app.id}>
                {app.label}
              </option>
            ))}
          </select>
        </div>
        {errorMessage ? (
          <p id={errorId} role="alert" className="text-xs text-rose-300">
            {errorMessage}
          </p>
        ) : null}
        <p id={statusId} aria-live="polite" className="text-xs text-slate-500">
          {isPending ? 'Updating scope…' : 'Dashboard reads now follow the selected tenant/app context.'}
        </p>
      </div>
    </section>
  );
}