import { NextResponse } from 'next/server';

import {
  authenticateUser,
  AuthError,
  setActiveScopeCookie,
  setSessionCookie,
} from '@/lib/auth';
import { z } from 'zod';

const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  mfaCode: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = loginRequestSchema.parse(await request.json());
    const session = await authenticateUser(body, {
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown',
      userAgent: request.headers.get('user-agent') ?? 'unknown',
    });

    const response = NextResponse.json({ ok: true, user: session.user, audit: session.audit });
    setSessionCookie(response, session.token, session.expiresAt);
    return setActiveScopeCookie(response, session.user);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.statusCode },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'INVALID_LOGIN_REQUEST', message: 'Provide a valid email and password.' } },
        { status: 400 },
      );
    }

    throw error;
  }
}
