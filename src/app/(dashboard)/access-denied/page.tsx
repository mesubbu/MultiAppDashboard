'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Lock, ShieldAlert } from 'lucide-react';

const suggestedDestinations = [
  { label: 'Platform Overview', href: '/' },
  { label: 'Events Monitor', href: '/events' },
  { label: 'Analytics', href: '/analytics' },
];

export default function AccessDeniedPage() {
  const searchParams = useSearchParams();
  const requiredPermission = searchParams.get('permission') ?? 'unknown';
  const fromPath = searchParams.get('from') ?? '/';

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10 text-amber-200">
          <Lock className="h-7 w-7" />
        </div>

        <h1 className="mt-6 text-2xl font-semibold text-white">Access denied</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          You don't have permission to access this resource. The required permission is:
        </p>

        <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200">
          <ShieldAlert className="h-4 w-4" />
          {requiredPermission.replace(':', ' · ')}
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 text-left">
          <h3 className="text-sm font-semibold text-white">What can I do?</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            <li>• Contact your platform administrator to request the needed permission.</li>
            <li>• Switch to a different tenant/app scope that grants higher access.</li>
            <li>• Navigate to a screen you're authorized to view.</li>
          </ul>
        </div>

        <div className="mt-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Suggested destinations</p>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestedDestinations.map((dest) => (
              <Link
                key={dest.href}
                href={dest.href as Route}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                {dest.label}
              </Link>
            ))}
          </div>
        </div>

        <Link
          href={fromPath as Route}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Go back
        </Link>
      </div>
    </div>
  );
}
