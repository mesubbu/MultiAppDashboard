import { getDashboardEnv } from '@/lib/env';
import {
  createSignedSessionToken,
  decodeSignedSessionToken,
  validateSessionCookie,
} from '@/lib/auth-shared';
import type { PlatformRole, SessionUser } from '@/types/platform';

export {
  ACTIVE_SCOPE_COOKIE,
  clearActiveScopeCookie,
  clearSessionCookie,
  SESSION_COOKIE,
  setActiveScopeCookie,
  setSessionCookie,
  validateSessionCookie,
} from '@/lib/auth-shared';

type StoredSession = {
  sessionId: string;
  user: SessionUser;
  createdAt: string;
  lastSeenAt: string;
};

type AuthDirectoryRecord = {
  email: string;
  password: string;
  mfaRequired: boolean;
  user: SessionUser;
};

export type LoginAuditRecord = {
  id: string;
  email: string;
  userId?: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  outcome: 'success' | 'failed';
  reason?: string;
};

export type ActiveSession = {
  sessionId: string;
  user: SessionUser;
  issuedAt: number;
  expiresAt: number;
  rotatedAt: number;
  refreshedToken?: string;
};

type AuthStateStore = {
  getSession(sessionId: string): Promise<StoredSession | null>;
  upsertSession(session: StoredSession): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  listLoginAudits(): Promise<LoginAuditRecord[]>;
  prependLoginAudit(record: LoginAuditRecord): Promise<void>;
  clear(options?: { preservePersistedState?: boolean }): Promise<void>;
};

const authDirectory: AuthDirectoryRecord[] = [
  {
    email: 'owner@platform.local',
    password: 'owner-demo-pass',
    mfaRequired: true,
    user: {
      userId: 'usr_platform_owner',
      tenantId: 'platform-root',
      appId: 'control-dashboard',
      name: 'Rhea Sharma',
      email: 'owner@platform.local',
      roles: ['platform_owner'],
    },
  },
  {
    email: 'admin@platform.local',
    password: 'admin-demo-pass',
    mfaRequired: true,
    user: {
      userId: 'usr_platform_admin',
      tenantId: 'platform-root',
      appId: 'control-dashboard',
      name: 'Ibrahim Khan',
      email: 'admin@platform.local',
      roles: ['platform_admin'],
    },
  },
  {
    email: 'ops@platform.local',
    password: 'ops-demo-pass',
    mfaRequired: false,
    user: {
      userId: 'usr_ops_admin',
      tenantId: 'platform-root',
      appId: 'control-dashboard',
      name: 'Nova Ops',
      email: 'ops@platform.local',
      roles: ['ops_admin'],
    },
  },
  {
    email: 'analyst@platform.local',
    password: 'analyst-demo-pass',
    mfaRequired: false,
    user: {
      userId: 'usr_analyst',
      tenantId: 'tenant_nova',
      appId: 'app_admin',
      name: 'Mei Chen',
      email: 'analyst@platform.local',
      roles: ['analyst'],
    },
  },
  {
    email: 'viewer@platform.local',
    password: 'viewer-demo-pass',
    mfaRequired: false,
    user: {
      userId: 'usr_viewer',
      tenantId: 'tenant_acme',
      appId: 'app_market_web',
      name: 'Diego Ramirez',
      email: 'viewer@platform.local',
      roles: ['viewer'],
    },
  },
];

let authStateStorePromise: Promise<AuthStateStore> | null = null;

async function getAuthStateStore(): Promise<AuthStateStore> {
  if (authStateStorePromise) {
    return authStateStorePromise;
  }

  authStateStorePromise = import('@/lib/auth-state.server')
    .then(({ getServerAuthStateStore }) =>
      getServerAuthStateStore({ filePath: getDashboardEnv().AUTH_STATE_FILE }),
    ) as Promise<AuthStateStore>;

  return authStateStorePromise;
}

export class AuthError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function listLoginAuditRecords() {
  return (await getAuthStateStore()).listLoginAudits();
}

export async function resetAuthStateForTests(options?: { preservePersistedState?: boolean }) {
  const { getServerAuthStateStore, resetServerAuthStateStoreCache } = await import(
    '@/lib/auth-state.server'
  );

  if (authStateStorePromise) {
    const store = await authStateStorePromise;
    await store.clear(options);
  } else if (getDashboardEnv().AUTH_STATE_FILE) {
    const store = await getServerAuthStateStore({ filePath: getDashboardEnv().AUTH_STATE_FILE });
    await store.clear(options);
  }

  authStateStorePromise = null;
  resetServerAuthStateStoreCache();
}

async function recordLoginAudit(entry: Omit<LoginAuditRecord, 'id'>) {
  const auditRecord: LoginAuditRecord = {
    id: `audit_login_${crypto.randomUUID()}`,
    ...entry,
  };
  await (await getAuthStateStore()).prependLoginAudit(auditRecord);

  console.info('[auth] login audit', auditRecord);
  return auditRecord;
}

export function hasPrivilegedRole(roles: PlatformRole[]) {
  return roles.includes('platform_owner') || roles.includes('platform_admin');
}

export async function getSessionFromToken(token: string): Promise<ActiveSession | null> {
  const validated = await validateSessionCookie(token);
  if (!validated) {
    return null;
  }

  const store = await getAuthStateStore();
  const stored = await store.getSession(validated.sessionId);
  if (!stored) {
    return null;
  }

  stored.lastSeenAt = new Date().toISOString();
  await store.upsertSession(stored);

  const nextClaims = validated.refreshedToken
    ? await decodeSignedSessionToken(validated.refreshedToken)
    : validated;

  if (!nextClaims) {
    return null;
  }

  return {
    sessionId: validated.sessionId,
    user: stored.user,
    issuedAt: nextClaims.issuedAt,
    expiresAt: nextClaims.expiresAt,
    rotatedAt: nextClaims.rotatedAt,
    refreshedToken: validated.refreshedToken,
  };
}

export async function createSession(user: SessionUser) {
  const sessionId = crypto.randomUUID();
  const claims = await createSignedSessionToken(sessionId);
  await (await getAuthStateStore()).upsertSession({
    sessionId,
    user,
    createdAt: new Date(claims.issuedAt).toISOString(),
    lastSeenAt: new Date(claims.issuedAt).toISOString(),
  });

  return {
    token: claims.token,
    sessionId,
    user,
    issuedAt: claims.issuedAt,
    expiresAt: claims.expiresAt,
  };
}

export async function updateSessionContext(
  sessionId: string,
  context: Pick<SessionUser, 'tenantId' | 'appId'>,
) {
  const store = await getAuthStateStore();
  const storedSession = await store.getSession(sessionId);
  if (!storedSession) {
    return null;
  }

  storedSession.user = {
    ...storedSession.user,
    tenantId: context.tenantId,
    appId: context.appId,
  };
  storedSession.lastSeenAt = new Date().toISOString();
  await store.upsertSession(storedSession);
  return storedSession.user;
}

export async function invalidateSession(sessionId: string) {
  await (await getAuthStateStore()).deleteSession(sessionId);
}

export async function invalidateSessionToken(token?: string) {
  if (!token) {
    return;
  }

  const claims = await decodeSignedSessionToken(token);
  if (claims?.sessionId) {
    await invalidateSession(claims.sessionId);
  }
}

export async function authenticateUser(
  credentials: { email: string; password: string; mfaCode?: string },
  metadata: { ipAddress: string; userAgent: string },
) {
  const normalizedEmail = credentials.email.trim().toLowerCase();
  const matchedAccount = authDirectory.find(
    (account) => account.email === normalizedEmail && account.password === credentials.password,
  );

  if (!matchedAccount) {
    await recordLoginAudit({
      email: normalizedEmail,
      timestamp: new Date().toISOString(),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      outcome: 'failed',
      reason: 'invalid_credentials',
    });
    throw new AuthError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  if (matchedAccount.mfaRequired && credentials.mfaCode !== getDashboardEnv().ADMIN_MFA_TEST_CODE) {
    await recordLoginAudit({
      email: normalizedEmail,
      userId: matchedAccount.user.userId,
      timestamp: new Date().toISOString(),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      outcome: 'failed',
      reason: 'invalid_mfa_code',
    });
    throw new AuthError(
      403,
      'INVALID_MFA_CODE',
      'A valid MFA code is required for this account.',
    );
  }

  const session = await createSession(matchedAccount.user);
  const audit = await recordLoginAudit({
    email: normalizedEmail,
    userId: matchedAccount.user.userId,
    timestamp: new Date().toISOString(),
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
    outcome: 'success',
  });

  return {
    ...session,
    audit,
  };
}

