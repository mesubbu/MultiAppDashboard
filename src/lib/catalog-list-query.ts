import { z } from 'zod';

import { roleSchema, statusSchema } from '@/types/contracts';
import type { PaginationInfo } from '@/types/platform';

type SearchParamInput = URLSearchParams | Record<string, string | string[] | undefined>;

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

function getParam(input: SearchParamInput, key: string) {
  if (input instanceof URLSearchParams) {
    return input.get(key) ?? undefined;
  }

  const value = input[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseWithSchema<T>(input: SearchParamInput, schema: z.ZodType<T>) {
  return schema.parse({
    page: getParam(input, 'page'),
    pageSize: getParam(input, 'page_size'),
    cursor: getParam(input, 'cursor'),
    query: getParam(input, 'q'),
    tenantId: getParam(input, 'tenant_id'),
    appId: getParam(input, 'app_id'),
    status: getParam(input, 'status'),
    timeRange: getParam(input, 'time_range'),
    environment: getParam(input, 'environment'),
    role: getParam(input, 'role'),
    eventType: getParam(input, 'event_type'),
    scope: getParam(input, 'scope'),
    actor: getParam(input, 'actor'),
    action: getParam(input, 'action'),
    resourceType: getParam(input, 'resource_type'),
    from: getParam(input, 'from'),
    to: getParam(input, 'to'),
  });
}

export type TenantListQuery = z.infer<typeof tenantListQuerySchema>;
export type AppListQuery = z.infer<typeof appListQuerySchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;
export type AgentListQuery = z.infer<typeof agentListQuerySchema>;
export type ToolListQuery = z.infer<typeof toolListQuerySchema>;
export type EventListQuery = z.infer<typeof eventListQuerySchema>;
export type MemoryListQuery = z.infer<typeof memoryListQuerySchema>;
export type ObservabilityListQuery = z.infer<typeof observabilityListQuerySchema>;
export type AuditListQuery = z.infer<typeof auditListQuerySchema>;

export function parseTenantListQuery(input: SearchParamInput) {
  return parseWithSchema(input, tenantListQuerySchema);
}

export function parseAppListQuery(input: SearchParamInput) {
  return parseWithSchema(input, appListQuerySchema);
}

export function parseUserListQuery(input: SearchParamInput) {
  return parseWithSchema(input, userListQuerySchema);
}

export function parseAgentListQuery(input: SearchParamInput) {
  return parseWithSchema(input, agentListQuerySchema);
}

export function parseToolListQuery(input: SearchParamInput) {
  return parseWithSchema(input, toolListQuerySchema);
}

export function parseEventListQuery(input: SearchParamInput) {
  return parseWithSchema(input, eventListQuerySchema);
}

export function parseMemoryListQuery(input: SearchParamInput) {
  return parseWithSchema(input, memoryListQuerySchema);
}

export function parseObservabilityListQuery(input: SearchParamInput) {
  return parseWithSchema(input, observabilityListQuerySchema);
}

export function parseAuditListQuery(input: SearchParamInput) {
  return parseWithSchema(input, auditListQuerySchema);
}

function encodeCursor(offset: number) {
  return Buffer.from(`offset:${offset}`).toString('base64url');
}

function decodeCursor(cursor?: string) {
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

function resolveStartIndex(page: number, pageSize: number, cursor?: string) {
  const decodedCursor = decodeCursor(cursor);
  if (decodedCursor != null) {
    return decodedCursor;
  }
  return Math.max(0, (page - 1) * pageSize);
}

export function buildPageInfo(page: number, pageSize: number, totalItems: number): PaginationInfo {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return {
    page: Math.min(page, totalPages),
    pageSize,
    totalItems,
    totalPages,
  };
}

export function hasListQuery(input: SearchParamInput, extraKeys: string[] = []) {
  return ['page', 'page_size', 'cursor', 'q', 'tenant_id', 'app_id', 'status', 'time_range', ...extraKeys].some(
    (key) => getParam(input, key) != null,
  );
}

export function isWithinTimeRange(value: string | null | undefined, timeRange?: z.infer<typeof timeRangeSchema>) {
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

export function isWithinDateRange(value: string | null | undefined, from?: string, to?: string) {
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

export function paginateItems<T>(
  items: T[],
  pageOrQuery: number | { page: number; pageSize: number; cursor?: string },
  pageSizeArg?: number,
) {
  const page = typeof pageOrQuery === 'number' ? pageOrQuery : pageOrQuery.page;
  const pageSize = typeof pageOrQuery === 'number' ? pageSizeArg ?? 10 : pageOrQuery.pageSize;
  const cursor = typeof pageOrQuery === 'number' ? undefined : pageOrQuery.cursor;
  const startIndex = resolveStartIndex(page, pageSize, cursor);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.floor(startIndex / pageSize) + 1, totalPages);
  const currentCursor = encodeCursor(startIndex);
  const nextStartIndex = startIndex + pageSize;
  const previousStartIndex = Math.max(0, startIndex - pageSize);

  const pageInfo: PaginationInfo = {
    page: safePage,
    pageSize,
    totalItems: items.length,
    totalPages,
    currentCursor,
    nextCursor: nextStartIndex < items.length ? encodeCursor(nextStartIndex) : undefined,
    previousCursor: startIndex > 0 ? encodeCursor(previousStartIndex) : undefined,
    hasNextPage: nextStartIndex < items.length,
    hasPreviousPage: startIndex > 0,
  };

  return {
    items: items.slice(startIndex, startIndex + pageInfo.pageSize),
    pageInfo,
  };
}