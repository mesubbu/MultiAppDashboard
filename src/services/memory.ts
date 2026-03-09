import {
  memoryAgentExperienceResponseSchema,
  memoryConversationListResponseSchema,
  memoryConversationWriteRequestSchema,
  memoryPreferenceListResponseSchema,
  memoryPreferenceWriteRequestSchema,
  memoryRetrieveRequestSchema,
  memoryRetrieveResponseSchema,
} from '@/types/contracts';
import { getDashboardEnv } from '@/lib/env';
import { getCurrentSessionUser } from '@/lib/session';

function getMemoryBaseUrl() {
  const env = getDashboardEnv();
  return env.CONTROL_PLANE_API_BASE_URL ?? env.NEXT_PUBLIC_CONTROL_PLANE_API_BASE_URL;
}

async function parseErrorPayload(response: Response) {
  return response.json().catch(() => null) as Promise<{ error?: { message?: string } } | null>;
}

async function requestMemory<T>(path: string, init: RequestInit, schema: { parse: (value: unknown) => T }, fallback: T) {
  const baseUrl = getMemoryBaseUrl();
  if (!baseUrl) return fallback;

  const sessionUser = await getCurrentSessionUser();
  if (!sessionUser) return fallback;

  const response = await fetch(new URL(path, baseUrl).toString(), {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.CONTROL_PLANE_API_TOKEN ?? ''}`,
      'x-tenant-id': sessionUser.tenantId,
      'x-app-id': sessionUser.appId,
      'x-user-id': sessionUser.userId,
      'x-user-roles': sessionUser.roles.join(','),
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = await parseErrorPayload(response);
    throw new Error(payload?.error?.message ?? `Memory Service request failed with status ${response.status}.`);
  }

  return schema.parse(await response.json());
}

export const memoryService = {
  isConfigured() {
    return Boolean(getMemoryBaseUrl());
  },
  retrieveContext(input: unknown) {
    return requestMemory(
      '/memory/retrieve',
      { method: 'POST', body: JSON.stringify(memoryRetrieveRequestSchema.parse(input)) },
      memoryRetrieveResponseSchema,
      memoryRetrieveResponseSchema.parse({}),
    );
  },
  saveConversationTurn(input: unknown) {
    return requestMemory(
      '/memory/conversations',
      { method: 'POST', body: JSON.stringify(memoryConversationWriteRequestSchema.parse(input)) },
      memoryConversationListResponseSchema,
      memoryConversationListResponseSchema.parse({ items: [] }),
    );
  },
  upsertPreferences(input: unknown) {
    return requestMemory(
      '/memory/preferences',
      { method: 'POST', body: JSON.stringify(memoryPreferenceWriteRequestSchema.parse(input)) },
      memoryPreferenceListResponseSchema,
      memoryPreferenceListResponseSchema.parse({ items: [] }),
    );
  },
  recordAgentExperience(input: unknown) {
    return requestMemory(
      '/memory/experience',
      { method: 'POST', body: JSON.stringify(input) },
      memoryAgentExperienceResponseSchema,
      memoryAgentExperienceResponseSchema.parse({
        item: {
          id: 'memory_service_unavailable',
          agentId: 'unknown',
          outcome: 'warning',
          summary: 'Memory Service unavailable.',
          sampleCount: 0,
          createdAt: new Date(0).toISOString(),
          metadata: {},
        },
      }),
    );
  },
};