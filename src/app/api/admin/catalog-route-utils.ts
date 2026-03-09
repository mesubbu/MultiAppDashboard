import { NextResponse } from 'next/server';
import { ZodError, type z } from 'zod';

import { type AuthorizedAdminContext } from '@/app/api/admin/_helpers';
import { AdminCatalogError } from '@/lib/admin-catalog.server';
import {
  CircuitBreakerOpenError,
  CONTROL_PLANE_REMOTE_CIRCUIT_KEY,
  runWithCircuitBreaker,
} from '@/lib/circuit-breaker';
import { getDashboardEnv } from '@/lib/env';

class ControlPlaneProxyError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly payload: unknown,
  ) {
    super(`Control plane request failed with status ${statusCode}`);
    this.name = 'ControlPlaneProxyError';
  }
}

function shouldTripControlPlaneCircuit(error: unknown) {
  return error instanceof ControlPlaneProxyError ? error.statusCode === 429 || error.statusCode >= 500 : true;
}

function createCircuitOpenResponse(retryAfterMs: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  const response = NextResponse.json(
    {
      error: {
        code: 'CONTROL_PLANE_CIRCUIT_OPEN',
        message: `The control plane circuit breaker is open after repeated failures. Retry in about ${retryAfterSeconds}s.`,
      },
    },
    { status: 503 },
  );
  response.headers.set('retry-after', `${retryAfterSeconds}`);
  return response;
}

export function createCatalogErrorResponse(error: unknown, invalidRequestCode: string, invalidRequestMessage: string) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: invalidRequestCode, message: invalidRequestMessage, details: error.flatten() } },
      { status: 400 },
    );
  }

  if (error instanceof AdminCatalogError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode },
    );
  }

  throw error;
}

export async function proxyCatalogRequest<T>(
  path: string,
  context: AuthorizedAdminContext,
  options: {
    method?: 'GET' | 'POST' | 'PATCH';
    body?: unknown;
    responseSchema: z.ZodType<T>;
  },
) {
  const env = getDashboardEnv();
  const baseUrl = env.CONTROL_PLANE_API_BASE_URL ?? env.NEXT_PUBLIC_CONTROL_PLANE_API_BASE_URL;
  if (!baseUrl) {
    return null;
  }

  try {
    return await runWithCircuitBreaker(
      CONTROL_PLANE_REMOTE_CIRCUIT_KEY,
      async () => {
        const response = await fetch(new URL(path, baseUrl), {
          method: options.method ?? 'GET',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${env.CONTROL_PLANE_API_TOKEN ?? ''}`,
            'x-tenant-id': context.scope.tenantId,
            'x-app-id': context.scope.appId,
            'x-user-id': context.session.user.userId,
            'x-user-roles': context.session.user.roles.join(','),
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
          cache: 'no-store',
        });

        const payload = await response.json().catch(() => null);
        if (response.ok) {
          try {
            return NextResponse.json(options.responseSchema.parse(payload), { status: response.status });
          } catch {
            throw new ControlPlaneProxyError(502, {
              error: {
                code: 'INVALID_CONTROL_PLANE_RESPONSE',
                message: 'The control plane returned an invalid response. Retry in a moment.',
              },
            });
          }
        }

        const errorPayload = payload ?? {
          error: {
            code: 'CONTROL_PLANE_REQUEST_FAILED',
            message: `The control plane could not process this request (${response.status}).`,
          },
        };
        if (response.status === 429 || response.status >= 500) {
          throw new ControlPlaneProxyError(response.status, errorPayload);
        }

        return NextResponse.json(
          errorPayload,
          { status: response.status },
        );
      },
      { shouldTrip: shouldTripControlPlaneCircuit },
    );
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      return createCircuitOpenResponse(error.retryAfterMs);
    }

    if (error instanceof ControlPlaneProxyError) {
      return NextResponse.json(error.payload, { status: error.statusCode >= 500 ? 502 : error.statusCode });
    }

    return NextResponse.json(
      {
        error: {
          code: 'CONTROL_PLANE_UNAVAILABLE',
          message: 'The control plane is temporarily unavailable. Retry in a moment.',
        },
      },
      { status: 502 },
    );
  }
}