'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/ErrorState';
import { reportClientError } from '@/lib/client-error-reporting';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void reportClientError({
      kind: 'boundary',
      source: 'dashboard-error-boundary',
      message: error.message,
      name: error.name,
      stack: error.stack,
      digest: error.digest,
    });
  }, [error]);

  return (
    <ErrorState
      title="This dashboard view failed to load"
      description="Retry the view to restore the latest platform state. If it keeps failing, the upstream API may be unavailable."
      onRetry={() => reset()}
      retryLabel="Retry view"
    />
  );
}