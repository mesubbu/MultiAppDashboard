import { NextResponse } from 'next/server';

import { getDashboardEnv } from '@/lib/env';

export const SESSION_COOKIE = 'platform_session';
export const ACTIVE_SCOPE_COOKIE = 'platform_active_scope';

type SessionTokenClaims = {
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
  rotatedAt: number;
};

function toBase64(input: string | Uint8Array) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input).toString('base64');
  }

  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(input: string) {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(input, 'base64'));
  }

  const binary = atob(input);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toBase64Url(input: string | Uint8Array) {
  return toBase64(input).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string) {
  const padded = `${input}${'='.repeat((4 - (input.length % 4 || 4)) % 4)}`
    .replaceAll('-', '+')
    .replaceAll('_', '/');
  return fromBase64(padded);
}

async function getSigningKey() {
  const env = getDashboardEnv();
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function signTokenPayload(payload: string) {
  const signature = await crypto.subtle.sign('HMAC', await getSigningKey(), new TextEncoder().encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

async function encodeSessionToken(claims: SessionTokenClaims) {
  const payload = toBase64Url(JSON.stringify(claims));
  const signature = await signTokenPayload(payload);
  return `${payload}.${signature}`;
}

export async function decodeSignedSessionToken(token: string) {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = await signTokenPayload(payload);
  if (expectedSignature !== signature) {
    return null;
  }

  try {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as SessionTokenClaims;
  } catch {
    return null;
  }
}

function shouldRotateSession(claims: SessionTokenClaims) {
  const env = getDashboardEnv();
  return claims.expiresAt - Date.now() <= env.SESSION_ROTATION_WINDOW_SECONDS * 1000;
}

function buildSessionClaims(sessionId: string) {
  const env = getDashboardEnv();
  const issuedAt = Date.now();
  return {
    sessionId,
    issuedAt,
    rotatedAt: issuedAt,
    expiresAt: issuedAt + env.SESSION_TTL_SECONDS * 1000,
  } satisfies SessionTokenClaims;
}

export async function createSignedSessionToken(sessionId: string) {
  const claims = buildSessionClaims(sessionId);
  return {
    ...claims,
    token: await encodeSessionToken(claims),
  };
}

export async function validateSessionCookie(token: string) {
  const claims = await decodeSignedSessionToken(token);
  if (!claims || claims.expiresAt <= Date.now()) {
    return null;
  }

  return {
    ...claims,
    refreshedToken: shouldRotateSession(claims)
      ? await encodeSessionToken(buildSessionClaims(claims.sessionId))
      : undefined,
  };
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: number) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: getDashboardEnv().NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresAt),
  });
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: getDashboardEnv().NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}

export function setActiveScopeCookie(
  response: NextResponse,
  scope: { tenantId: string; appId: string },
) {
  response.cookies.set(
    ACTIVE_SCOPE_COOKIE,
    JSON.stringify({ tenantId: scope.tenantId, appId: scope.appId }),
    {
      httpOnly: false,
      sameSite: 'lax',
      secure: getDashboardEnv().NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    },
  );
  return response;
}

export function clearActiveScopeCookie(response: NextResponse) {
  response.cookies.set(ACTIVE_SCOPE_COOKIE, '', {
    httpOnly: false,
    sameSite: 'lax',
    secure: getDashboardEnv().NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}