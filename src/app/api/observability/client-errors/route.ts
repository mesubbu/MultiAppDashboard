import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { getSessionFromToken, SESSION_COOKIE } from '@/lib/auth';
import { recordRecentClientError } from '@/lib/client-error-store.server';
import { isDashboardDatabaseConfigured, queryDashboardDb } from '@/lib/db/postgres';

const clientErrorSchema = z.object({
  kind: z.enum(['boundary', 'window-error', 'unhandledrejection']),
  source: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(4000),
  name: z.string().trim().max(160).optional(),
  stack: z.string().trim().max(12000).optional(),
  pathname: z.string().trim().max(300).optional(),
  componentStack: z.string().trim().max(8000).optional(),
  digest: z.string().trim().max(160).optional(),
  userAgent: z.string().trim().max(600).optional(),
});

function truncate(value: string | undefined, length: number) {
  return value ? value.slice(0, length) : value;
}

async function getOptionalSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  return getSessionFromToken(token);
}

export async function POST(request: NextRequest) {
  try {
    const payload = clientErrorSchema.parse(await request.json());
    const session = await getOptionalSession(request);
    const timestamp = new Date().toISOString();
    const errorRecord = {
      id: `audit_client_error_${crypto.randomUUID()}`,
      action: 'client_error',
      resourceType: 'ui',
      resourceId: truncate(payload.pathname ?? payload.source, 120) ?? 'unknown-ui-surface',
      summary: truncate(`${payload.name ?? 'Error'}: ${payload.message}`, 500) ?? 'Client error',
      metadata: {
        kind: payload.kind,
        source: payload.source,
        message: payload.message,
        pathname: payload.pathname ?? null,
        digest: payload.digest ?? null,
        name: payload.name ?? null,
        stack: payload.stack ?? null,
        componentStack: payload.componentStack ?? null,
        userAgent: payload.userAgent ?? null,
      },
      timestamp,
      tenantId: session?.user.tenantId ?? null,
      appId: session?.user.appId ?? null,
      userId: session?.user.userId ?? null,
    };

    recordRecentClientError({
      id: errorRecord.id,
      kind: payload.kind,
      source: payload.source,
      message: payload.message,
      name: payload.name ?? 'ClientError',
      pathname: payload.pathname ?? null,
      digest: payload.digest ?? null,
      occurredAt: timestamp,
      tenantId: errorRecord.tenantId,
      appId: errorRecord.appId,
      userId: errorRecord.userId,
    });

    if (isDashboardDatabaseConfigured()) {
      await queryDashboardDb(
        `INSERT INTO audit_logs (id, tenant_id, app_id, user_id, action, resource_type, resource_id, summary, metadata_json, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
        [
          errorRecord.id,
          errorRecord.tenantId,
          errorRecord.appId,
          errorRecord.userId,
          errorRecord.action,
          errorRecord.resourceType,
          errorRecord.resourceId,
          errorRecord.summary,
          JSON.stringify(errorRecord.metadata),
          errorRecord.timestamp,
        ],
      );
    } else {
      console.error('[client-error]', errorRecord);
    }

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_CLIENT_ERROR_REPORT',
          message: error instanceof Error ? error.message : 'Unable to record client error.',
        },
      },
      { status: 400 },
    );
  }
}
