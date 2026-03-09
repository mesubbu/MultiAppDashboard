import { NextResponse } from 'next/server';

import {
  clearActiveScopeCookie,
  clearSessionCookie,
  invalidateSessionToken,
  SESSION_COOKIE,
} from '@/lib/auth';

export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const sessionToken = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);

  await invalidateSessionToken(sessionToken);

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return clearActiveScopeCookie(response);
}
