import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
  clearSessionCookie,
  SESSION_COOKIE,
  setSessionCookie,
  validateSessionCookie,
} from '@/lib/auth-shared';

export async function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const { pathname } = request.nextUrl;
  const session = sessionToken ? await validateSessionCookie(sessionToken) : null;

  if (pathname === '/login') {
    if (session) {
      const response = NextResponse.redirect(new URL('/', request.url));
      if (session.refreshedToken) {
        setSessionCookie(response, session.refreshedToken, session.expiresAt);
      }
      return response;
    }

    if (sessionToken && !session) {
      return clearSessionCookie(NextResponse.next());
    }

    return NextResponse.next();
  }

  if (!session) {
    return clearSessionCookie(NextResponse.redirect(new URL('/login', request.url)));
  }

  const response = NextResponse.next();
  if (session.refreshedToken) {
    setSessionCookie(response, session.refreshedToken, session.expiresAt);
  }
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
