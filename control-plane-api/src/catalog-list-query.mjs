import { z } from 'zod';

import { roleSchema, statusSchema } from './contracts.mjs';

const positiveIntSchema = z.coerce.number().int().min(1);
export const timeRangeSchema = z.enum(['1h', '24h', '7d', '30d', '90d']);

const baseListQuerySchema = z.object({
  page: positiveIntSchema.default(1),
  pageSize: positiveIntSchema.max(100).default(10),
  cursor: z.string().trim().min(1).optional(),
  query: z.string().trim().max(100).default(''),
  tenantId: z.string().trim().min(1).optional(),
  appId: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).max(64).optional(),
  timeRange: timeRangeSchema.optional(),
});

const tenantListQuerySchema = baseListQuerySchema.extend({
  status: statusSchema.optional(),
});

const appListQuerySchema = baseListQuerySchema.extend({
  status: statusSchema.optional(),
  environment: z.enum(['production', 'staging', 'development']).optional(),
});

const userListQuerySchema = baseListQuerySchema.extend({
  status: z.enum(['active', 'invited', 'suspended']).optional(),
  role: roleSchema.optional(),
});

const agentListQuerySchema = baseListQuerySchema.extend({
  status: z.enum(['running', 'paused', 'throttled', 'error']).optional(),
});

const toolListQuerySchema = baseListQuerySchema;

const eventListQuerySchema = baseListQuerySchema.extend({
  eventType: z.enum([
    'listing_created', 'order_placed', 'message_sent', 'agent_triggered',
    'tenant_created', 'tenant_updated', 'app_created', 'app_updated',
    'user_created', 'user_updated', 'agent_action_requested', 'model_switched',
    'research_requested', 'analysis_completed', 'signal_detected', 'search_performed',
  ]).optional(),
});

const memoryListQuerySchema = baseListQuerySchema.extend({
  scope: z.enum(['tenant', 'app', 'agent']).optional(),
});

const observabilityListQuerySchema = baseListQuerySchema.extend({
  status: statusSchema.optional(),
});

const auditListQuerySchema = baseListQuerySchema.extend({
  actor: z.string().trim().min(1).optional(),
  action: z.string().trim().min(1).optional(),
  resourceType: z.enum(['agent', 'model', 'tenant', 'app', 'user', 'system', 'tool', 'workflow', 'research']).optional(),
  from: z.string().trim().min(1).optional(),
  to: z.string().trim().min(1).optional(),
});

function getParam(searchParams, key) {
  return searchParams.get(key) ?? undefined;
}

function parseWithSchema(searchParams, schema) {
  return schema.parse({
    page: getParam(searchParams, 'page'),
    pageSize: getParam(searchParams, 'page_size'),
    cursor: getParam(searchParams, 'cursor'),
    query: getParam(searchParams, 'q'),
    tenantId: getParam(searchParams, 'tenant_id'),
    appId: getParam(searchParams, 'app_id'),
    status: getParam(searchParams, 'status'),
    timeRange: getParam(searchParams, 'time_range'),
    environment: getParam(searchParams, 'environment'),
    role: getParam(searchParams, 'role'),
    eventType: getParam(searchParams, 'event_type'),
    scope: getParam(searchParams, 'scope'),
    actor: getParam(searchParams, 'actor'),
    action: getParam(searchParams, 'action'),
    resourceType: getParam(searchParams, 'resource_type'),
    from: getParam(searchParams, 'from'),
    to: getParam(searchParams, 'to'),
  });
}

export function parseTenantListQuery(searchParams) {
  return parseWithSchema(searchParams, tenantListQuerySchema);
}

export function parseAppListQuery(searchParams) {
  return parseWithSchema(searchParams, appListQuerySchema);
}

export function parseUserListQuery(searchParams) {
  return parseWithSchema(searchParams, userListQuerySchema);
}

export function parseAgentListQuery(searchParams) {
  return parseWithSchema(searchParams, agentListQuerySchema);
}

export function parseToolListQuery(searchParams) {
  return parseWithSchema(searchParams, toolListQuerySchema);
}

export function parseEventListQuery(searchParams) {
  return parseWithSchema(searchParams, eventListQuerySchema);
}

export function parseMemoryListQuery(searchParams) {
  return parseWithSchema(searchParams, memoryListQuerySchema);
}

export function parseObservabilityListQuery(searchParams) {
  return parseWithSchema(searchParams, observabilityListQuerySchema);
}

export function parseAuditListQuery(searchParams) {
  return parseWithSchema(searchParams, auditListQuerySchema);
}

function encodeCursor(offset) {
  return Buffer.from(`offset:${offset}`).toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor) {
    return null;
  }

  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const [prefix, value] = decoded.split(':');
    if (prefix !== 'offset') {
      return null;
    }
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  } catch {
    return null;
  }
}

function resolveStartIndex(page, pageSize, cursor) {
  const decodedCursor = decodeCursor(cursor);
  if (decodedCursor != null) {
    return decodedCursor;
  }
  return Math.max(0, (page - 1) * pageSize);
}

export function hasListQuery(searchParams, extraKeys = []) {
  return ['page', 'page_size', 'cursor', 'q', 'tenant_id', 'app_id', 'status', 'time_range', ...extraKeys].some(
    (key) => getParam(searchParams, key) != null,
  );
}

export function isWithinTimeRange(value, timeRange) {
  if (!timeRange || !value) {
    return true;
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return false;
  }

  const hoursByRange = { '1h': 1, '24h': 24, '7d': 24 * 7, '30d': 24 * 30, '90d': 24 * 90 };
  const threshold = Date.now() - hoursByRange[timeRange] * 60 * 60 * 1000;
  return timestamp >= threshold;
}

export function isWithinDateRange(value, from, to) {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return false;
  }

  const fromTime = from ? new Date(from).getTime() : null;
  const toTime = to ? new Date(to).getTime() : null;
  if (fromTime != null && !Number.isNaN(fromTime) && timestamp < fromTime) {
    return false;
  }
  if (toTime != null && !Number.isNaN(toTime) && timestamp > toTime) {
    return false;
  }
  return true;
}

export function paginateItems(items, pageOrQuery, pageSizeArg) {
  const page = typeof pageOrQuery === 'number' ? pageOrQuery : pageOrQuery.page;
  const pageSize = typeof pageOrQuery === 'number' ? pageSizeArg ?? 10 : pageOrQuery.pageSize;
  const cursor = typeof pageOrQuery === 'number' ? undefined : pageOrQuery.cursor;
  const startIndex = resolveStartIndex(page, pageSize, cursor);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.floor(startIndex / pageSize) + 1, totalPages);
  const currentCursor = encodeCursor(startIndex);
  const nextStartIndex = startIndex + pageSize;
  const previousStartIndex = Math.max(0, startIndex - pageSize);
  return {
    items: items.slice(startIndex, startIndex + pageSize),
    pageInfo: {
      page: safePage,
      pageSize,
      totalItems: items.length,
      totalPages,
      currentCursor,
      nextCursor: nextStartIndex < items.length ? encodeCursor(nextStartIndex) : undefined,
      previousCursor: startIndex > 0 ? encodeCursor(previousStartIndex) : undefined,
      hasNextPage: nextStartIndex < items.length,
      hasPreviousPage: startIndex > 0,
    },
  };
}