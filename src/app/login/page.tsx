'use client';

import { FormEvent, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const mfaId = useId();
  const errorId = useId();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: 'owner@platform.local',
    password: 'owner-demo-pass',
    mfaCode: '000000',
  });

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setErrorMessage(payload?.error?.message ?? 'Unable to sign in.');
      setIsLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <main id="login-content" className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_25%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] px-4">
      <a href="#login-form" className="skip-link">
        Skip to sign-in form
      </a>
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950/80 p-8 shadow-2xl shadow-slate-950/30">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Platform Admin</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">AI Platform Control Dashboard</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">A multi-tenant operations surface for Cloudflare edge services, AI orchestration containers, model routing, tool governance, memory, graph intelligence, and observability.</p>
        <div className="mt-8 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <p>• Session includes `tenant_id`, `app_id`, and `user_id` context headers</p>
          <p>• RBAC covers platform owners, tenant admins, ops admins, analysts, and viewers</p>
          <p>• Privileged accounts require MFA. Demo code: `000000` unless overridden in env.</p>
        </div>
        <form id="login-form" onSubmit={handleLogin} className="mt-8 space-y-4" aria-describedby={errorMessage ? errorId : undefined}>
          <div>
            <label htmlFor={emailId} className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Email</label>
            <input
              id={emailId}
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            />
          </div>
          <div>
            <label htmlFor={passwordId} className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Password</label>
            <input
              id={passwordId}
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            />
          </div>
          <div>
            <label htmlFor={mfaId} className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">MFA code</label>
            <input
              id={mfaId}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={form.mfaCode}
              onChange={(event) => setForm((current) => ({ ...current, mfaCode: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            />
          </div>
          {errorMessage ? (
            <div id={errorId} role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {errorMessage}
            </div>
          ) : null}
          <button type="submit" disabled={isLoading} className="inline-flex w-full items-center justify-center rounded-2xl bg-cyan-500 px-4 py-3 font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-70">
            {isLoading ? 'Signing in…' : 'Enter dashboard'}
          </button>
        </form>
      </div>
    </main>
  );
}
