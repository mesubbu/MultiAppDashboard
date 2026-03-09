import { NextResponse } from 'next/server';

import { withPermission } from '@/app/api/admin/_helpers';
import { adminRoutePermissions } from '@/app/api/admin/permissions';
import { parseAuditListQuery } from '@/lib/catalog-list-query';
import { controlPlaneService } from '@/services/control-plane';

function toCsv(rows: Awaited<ReturnType<typeof controlPlaneService.getAuditPage>>['items']) {
  const header = ['timestamp', 'actor', 'action', 'resourceType', 'resourceId', 'tenantId', 'appId', 'summary'];
  const escape = (value: string | null | undefined) => `"${(value ?? '').replaceAll('"', '""')}"`;
  const lines = rows.map((row) =>
    [row.timestamp, row.actor, row.action, row.resourceType, row.resourceId, row.tenantId ?? '', row.appId ?? '', row.summary ?? '']
      .map((value) => escape(String(value)))
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export const GET = withPermission(adminRoutePermissions.audit, async (request) => {
  const format = request.nextUrl.searchParams.get('format') === 'json' ? 'json' : 'csv';
  const query = parseAuditListQuery(request.nextUrl.searchParams);
  const response = await controlPlaneService.getAuditPage({ ...query, page: 1, pageSize: 200 });

  if (format === 'json') {
    return NextResponse.json(response.items, {
      headers: {
        'Content-Disposition': 'attachment; filename="audit-log.json"',
      },
    });
  }

  return new NextResponse(toCsv(response.items), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="audit-log.csv"',
    },
  });
});