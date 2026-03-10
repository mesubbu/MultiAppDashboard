'use client';

import { FormEvent, useId, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Mail, MessageSquare, ShieldCheck } from 'lucide-react';

type RecoveryMethod = 'password' | 'backup-mfa' | 'support';

export default function AuthRecoveryPage() {
  const emailId = useId();
  const backupCodeId = useId();
  const [method, setMethod] = useState<RecoveryMethod>('password');
  const [email, setEmail] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    // Simulate recovery request
    await new Promise((resolve) => setTimeout(resolve, 1200));

    if (method === 'backup-mfa' && backupCode.length < 6) {
      setErrorMessage('Backup code must be at least 6 characters.');
      setIsSubmitting(false);
      return;
    }
    setSubmitted(true);
    setIsSubmitting(false);
  }

  const methods: { key: RecoveryMethod; icon: typeof Mail; label: string; description: string }[] = [
    { key: 'password', icon: Mail, label: 'Password reset', description: 'Send a password reset link to your email address.' },
    { key: 'backup-mfa', icon: KeyRound, label: 'Backup MFA code', description: 'Use one of your pre-generated backup codes.' },
    { key: 'support', icon: MessageSquare, label: 'Contact support', description: 'Reach the platform admin team for account recovery.' },
  ];

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_25%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] px-4">
      <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-950/80 p-8 shadow-2xl shadow-slate-950/30">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-cyan-300 transition hover:text-cyan-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to login
        </Link>

        <div className="mt-6 flex items-start gap-4">
          <div className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Account Recovery</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Choose a recovery method to restore access to your platform account.
            </p>
          </div>
        </div>

        {submitted ? (
          <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/15 text-emerald-200">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">
              {method === 'password' && 'Recovery email sent'}
              {method === 'backup-mfa' && 'Backup code accepted'}
              {method === 'support' && 'Support request submitted'}
            </h3>
            <p className="mt-2 text-sm text-emerald-100/80">
              {method === 'password' && 'Check your inbox for a password reset link. It will expire in 15 minutes.'}
              {method === 'backup-mfa' && 'Your session has been restored. You will be redirected shortly.'}
              {method === 'support' && 'The platform team will contact you at the email address on file within 24 hours.'}
            </p>
            <Link
              href="/login"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign-in
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.5fr]">
            {/* Method selector */}
            <div className="space-y-3">
              {methods.map((m) => {
                const Icon = m.icon;
                const isActive = method === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => { setMethod(m.key); setErrorMessage(null); }}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      isActive
                        ? 'border-cyan-400/30 bg-cyan-400/10 text-white ring-1 ring-cyan-400/30'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-cyan-300" />
                      <span className="font-medium">{m.label}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{m.description}</p>
                  </button>
                );
              })}
            </div>

            {/* Recovery form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {method === 'password' && (
                <div>
                  <label htmlFor={emailId} className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                    Account email
                  </label>
                  <input
                    id={emailId}
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/40"
                  />
                </div>
              )}

              {method === 'backup-mfa' && (
                <div>
                  <label htmlFor={backupCodeId} className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                    Backup code
                  </label>
                  <input
                    id={backupCodeId}
                    type="text"
                    autoComplete="one-time-code"
                    required
                    value={backupCode}
                    onChange={(event) => setBackupCode(event.target.value)}
                    placeholder="Enter your backup code"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/40"
                  />
                  <p className="mt-2 text-xs text-slate-500">This is one of the codes you saved when MFA was enabled.</p>
                </div>
              )}

              {method === 'support' && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-sm font-semibold text-white">Platform support</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    If you cannot use the self-service recovery options, the support team can help restore access after identity verification.
                  </p>
                  <div className="mt-4 space-y-2 text-sm text-slate-300">
                    <p>📧 support@platform.local</p>
                    <p>📋 Include your registered email and describe the access issue.</p>
                  </div>
                </div>
              )}

              {errorMessage ? (
                <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {errorMessage}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-cyan-500 px-4 py-3 font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-70"
              >
                {isSubmitting ? 'Processing…' : method === 'support' ? 'Submit support request' : 'Continue'}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
