'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/ErrorState';
import { reportClientError } from '@/lib/client-error-reporting';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void reportClientError({
      kind: 'boundary',
      source: 'root-error-boundary',
      message: error.message,
      name: error.name,
      stack: error.stack,
      digest: error.digest,
    });
  }, [error]);

  return (
    <ErrorState
      fullScreen
      title="Something went wrong while loading the dashboard"
      description="Please retry the request. If the problem persists, refresh the session or inspect the latest deployment logs."
      onRetry={() => reset()}
    />
  );
}
