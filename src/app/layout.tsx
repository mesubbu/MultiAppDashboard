import '@xyflow/react/dist/style.css';
import './globals.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Suspense } from 'react';

import { ClientErrorReporter } from '@/components/observability/ClientErrorReporter';
import { ToastProvider } from '@/components/ui/toast';

export const metadata: Metadata = {
  title: 'AI Platform Control Dashboard',
  description: 'Production-grade multi-tenant AI platform operations dashboard.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <Suspense fallback={null}>
            <ClientErrorReporter />
          </Suspense>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
