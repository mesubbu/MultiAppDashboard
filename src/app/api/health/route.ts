import { NextResponse } from 'next/server';

import { getDashboardEnv } from '@/lib/env';

export async function GET() {
  const env = getDashboardEnv();

  return NextResponse.json({
    name: 'ai-platform-control-dashboard',
    status: 'ok',
    environment: env.NODE_ENV,
    databaseConfigured: Boolean(env.DATABASE_URL),
    controlPlaneBaseUrl: env.CONTROL_PLANE_API_BASE_URL ?? env.NEXT_PUBLIC_CONTROL_PLANE_API_BASE_URL ?? null,
    timestamp: new Date().toISOString(),
  });
}