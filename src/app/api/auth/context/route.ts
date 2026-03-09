import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';

import { getSessionFromToken, SESSION_COOKIE, setActiveScopeCookie, updateSessionContext } from '@/lib/auth';
import { appsData, tenantsData } from '@/mocks/platform-data';
import { resolveSessionScope } from '@/lib/scope';

const sessionContextSchema = z.object({
  tenantId: z.string().optional(),
  appId: z.string().optional(),
});

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication is required.' } },
      { status: 401 },
    );
  }

  const session = await getSessionFromToken(token);
  if (!session) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Your session is invalid or has expired.' } },
      { status: 401 },
    );
  }

  try {
    const payload = sessionContextSchema.parse(await request.json());
    const nextScope = resolveSessionScope(session.user, payload, tenantsData, appsData);
    const user = await updateSessionContext(session.sessionId, nextScope);
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Your session no longer exists.' } },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ ok: true, user });
    return setActiveScopeCookie(response, user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'INVALID_SCOPE_REQUEST', message: 'Provide a valid tenant/app context payload.' } },
        { status: 400 },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: { code: 'INVALID_SCOPE', message: error.message } },
        { status: 400 },
      );
    }

    throw error;
  }
}