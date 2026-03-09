import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
  clearSessionCookie,
  getSessionFromToken,
  SESSION_COOKIE,
  setSessionCookie,
} from '@/lib/auth';
import { appsData, tenantsData } from '@/mocks/platform-data';
import { resolveSessionScope } from '@/lib/scope';
import { hasPermission } from '@/lib/rbac';
import type { Permission, SessionUser } from '@/types/platform';

type AdminHandlerContext = {
  session: NonNullable<Awaited<ReturnType<typeof getSessionFromToken>>>;
  scope: Pick<SessionUser, 'tenantId' | 'appId'>;
};

type RouteParams = Record<string, string | string[] | undefined>;
type EmptyRouteParams = Record<never, never>;

type RouteContext<TParams extends RouteParams = EmptyRouteParams> = {
  params: Promise<TParams>;
};

export type AuthorizedAdminContext<TParams extends RouteParams = EmptyRouteParams> =
  RouteContext<TParams> & AdminHandlerContext;

type AdminRouteHandler<TParams extends RouteParams = EmptyRouteParams> = (
  request: NextRequest,
  context: AuthorizedAdminContext<TParams>,
) => Promise<Response> | Response;

export async function requireAdminRequest(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return {
      session: null,
      response: NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication is required.' } }, { status: 401 }),
    };
  }

  const session = await getSessionFromToken(token);
  if (!session) {
    return {
      session: null,
      response: clearSessionCookie(
        NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Your session is invalid or has expired.' } },
          { status: 401 },
        ),
      ),
    };
  }

  return { session, response: null };
}

export function resolveAdminRequestScope(
  request: NextRequest,
  user: Pick<SessionUser, 'tenantId' | 'appId' | 'roles'>,
) {
  return resolveSessionScope(
    user as SessionUser,
    {
      tenantId: request.nextUrl.searchParams.get('tenant_id') ?? undefined,
      appId: request.nextUrl.searchParams.get('app_id') ?? undefined,
    },
    tenantsData,
    appsData,
  );
}

export function withPermission<TParams extends RouteParams = EmptyRouteParams>(
  permission: Permission,
  handler: AdminRouteHandler<TParams>,
) {
  return async (request: NextRequest, context: RouteContext<TParams>) => {
    const { session, response } = await requireAdminRequest(request);
    if (!session) {
      return response;
    }

    if (!hasPermission(session.user.roles, permission)) {
      const forbiddenResponse = NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: `This action requires the ${permission} permission.`,
          },
        },
        { status: 403 },
      );

      if (session.refreshedToken) {
        setSessionCookie(forbiddenResponse, session.refreshedToken, session.expiresAt);
      }

      return forbiddenResponse;
    }

    const result = await handler(request, {
      ...context,
      session,
      scope: resolveAdminRequestScope(request, session.user),
    });
    if (session.refreshedToken && result instanceof NextResponse) {
      setSessionCookie(result, session.refreshedToken, session.expiresAt);
    }

    return result;
  };
}
