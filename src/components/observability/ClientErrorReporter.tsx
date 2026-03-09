'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { reportClientError } from '@/lib/client-error-reporting';

function normalizeUnhandledReason(reason: unknown) {
  if (reason instanceof Error) {
    return {
      message: reason.message,
      name: reason.name,
      stack: reason.stack,
    };
  }

  if (typeof reason === 'string') {
    return {
      message: reason,
      name: 'UnhandledPromiseRejection',
      stack: undefined,
    };
  }

  return {
    message: 'An unhandled promise rejection occurred.',
    name: 'UnhandledPromiseRejection',
    stack: undefined,
  };
}

export function ClientErrorReporter() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const routePath = `${pathname}${search ? `?${search}` : ''}`;

  useEffect(() => {
    function handleWindowError(event: ErrorEvent) {
      void reportClientError({
        kind: 'window-error',
        source: 'window.error',
        pathname: routePath,
        message: event.error?.message ?? event.message ?? 'An unexpected client error occurred.',
        name: event.error?.name,
        stack: event.error?.stack,
      });
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      const normalized = normalizeUnhandledReason(event.reason);
      void reportClientError({
        kind: 'unhandledrejection',
        source: 'window.unhandledrejection',
        pathname: routePath,
        message: normalized.message,
        name: normalized.name,
        stack: normalized.stack,
      });
    }

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [routePath]);

  return null;
}
