import {
  aiAnalyzeRequestSchema,
  aiGatewayResponseSchema,
  aiRecommendRequestSchema,
  aiResearchRequestSchema,
} from '@/types/contracts';
import { getDashboardEnv } from '@/lib/env';
import { getCurrentSessionUser } from '@/lib/session';
import {
  AI_GATEWAY_REMOTE_CIRCUIT_KEY,
  CircuitBreakerOpenError,
  runWithCircuitBreaker,
} from '@/lib/circuit-breaker';

export class AiGatewayServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AiGatewayServiceError';
  }
}

function getAiGatewayBaseUrl() {
  const env = getDashboardEnv();
  return env.CONTROL_PLANE_API_BASE_URL ?? env.NEXT_PUBLIC_CONTROL_PLANE_API_BASE_URL;
}

async function parseErrorPayload(response: Response) {
  return response.json().catch(() => null) as Promise<{ error?: { code?: string; message?: string } } | null>;
}

function getFriendlyAiGatewayMessage(statusCode?: number) {
  if (statusCode === 401) return 'Your session expired while contacting the AI Gateway. Sign in again and retry.';
  if (statusCode === 403) return 'You do not have permission to use the AI Gateway for this request.';
  if (statusCode === 429) return 'The AI Gateway is currently rate limited. Retry in a moment.';
  if (statusCode && statusCode >= 500) return 'The AI Gateway is temporarily unavailable. Falling back to local analysis.';
  return 'The AI Gateway is temporarily unavailable. Falling back to local analysis.';
}

function shouldTripAiGatewayCircuit(error: unknown) {
  return error instanceof AiGatewayServiceError
    ? error.statusCode === 429 || (error.statusCode ?? 0) >= 500
    : true;
}

function getCircuitOpenAiGatewayMessage(retryAfterMs: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return `The AI Gateway circuit breaker is open after repeated failures. Retry in about ${retryAfterSeconds}s.`;
}

async function postToAiGateway<T>(path: string, body: unknown, schema: { parse: (value: unknown) => T }) {
  const baseUrl = getAiGatewayBaseUrl();
  if (!baseUrl) {
    throw new AiGatewayServiceError('The AI Gateway is not configured.', 503, 'AI_GATEWAY_NOT_CONFIGURED');
  }

  const sessionUser = await getCurrentSessionUser();
  if (!sessionUser) {
    throw new AiGatewayServiceError('Your session expired. Sign in again to continue.', 401, 'UNAUTHORIZED');
  }

  const url = new URL(path, baseUrl);

  try {
    return await runWithCircuitBreaker(
      AI_GATEWAY_REMOTE_CIRCUIT_KEY,
      async () => {
        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${process.env.CONTROL_PLANE_API_TOKEN ?? ''}`,
            'x-tenant-id': sessionUser.tenantId,
            'x-app-id': sessionUser.appId,
            'x-user-id': sessionUser.userId,
            'x-user-roles': sessionUser.roles.join(','),
          },
          body: JSON.stringify(body),
          cache: 'no-store',
        });

        if (!response.ok) {
          const payload = await parseErrorPayload(response);
          throw new AiGatewayServiceError(
            payload?.error?.message ?? getFriendlyAiGatewayMessage(response.status),
            response.status,
            payload?.error?.code ?? 'AI_GATEWAY_REQUEST_FAILED',
          );
        }

        const payload = await response.json().catch(() => {
          throw new AiGatewayServiceError(
            'The AI Gateway returned an invalid response. Falling back to local analysis.',
            502,
            'INVALID_AI_GATEWAY_RESPONSE',
          );
        });

        try {
          return schema.parse(payload);
        } catch {
          throw new AiGatewayServiceError(
            'The AI Gateway returned an invalid response. Falling back to local analysis.',
            502,
            'INVALID_AI_GATEWAY_RESPONSE',
          );
        }
      },
      { shouldTrip: shouldTripAiGatewayCircuit },
    );
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      throw new AiGatewayServiceError(
        getCircuitOpenAiGatewayMessage(error.retryAfterMs),
        503,
        'AI_GATEWAY_CIRCUIT_OPEN',
      );
    }

    if (error instanceof AiGatewayServiceError) {
      throw error;
    }

    throw new AiGatewayServiceError(
      'The AI Gateway is temporarily unavailable. Falling back to local analysis.',
      502,
      'AI_GATEWAY_UNAVAILABLE',
    );
  }
}

export const aiGatewayService = {
  isConfigured() {
    return Boolean(getAiGatewayBaseUrl());
  },
  analyze: (input: unknown) => postToAiGateway('/ai/analyze', aiAnalyzeRequestSchema.parse(input), aiGatewayResponseSchema),
  command: (input: unknown) => postToAiGateway('/ai/command', aiAnalyzeRequestSchema.parse(input), aiGatewayResponseSchema),
  research: (input: unknown) => postToAiGateway('/ai/research', aiResearchRequestSchema.parse(input), aiGatewayResponseSchema),
  recommend: (input: unknown) => postToAiGateway('/ai/recommend', aiRecommendRequestSchema.parse(input), aiGatewayResponseSchema),
};