import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getSessionFromToken, SESSION_COOKIE } from '@/lib/auth';

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  return getSessionFromToken(token);
}

export async function getCurrentSessionUser() {
  return (await getCurrentSession())?.user ?? null;
}

export async function requireCurrentSession() {
  const session = await getCurrentSession();
  if (!session) {
    redirect('/login');
  }

  return session;
}