import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  authenticateUser,
  AuthError,
  getSessionFromToken,
  invalidateSession,
  listLoginAuditRecords,
  resetAuthStateForTests,
  updateSessionContext,
} from '@/lib/auth';
import { resetDashboardEnvForTests } from '@/lib/env';

describe('auth session flow', () => {
  beforeEach(async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    delete process.env.SESSION_SECRET;
    delete process.env.ADMIN_MFA_TEST_CODE;
    delete process.env.AUTH_STATE_FILE;
    resetDashboardEnvForTests();
    await resetAuthStateForTests();
  });

  it('creates a session for valid credentials and resolves the session user from the token', async () => {
    const login = await authenticateUser(
      { email: 'viewer@platform.local', password: 'viewer-demo-pass' },
      { ipAddress: '127.0.0.1', userAgent: 'vitest' },
    );

    const session = await getSessionFromToken(login.token);
    expect(session?.user.userId).toBe('usr_viewer');
    expect(session?.user.roles).toEqual(['viewer']);
  });

  it('requires MFA for privileged accounts', async () => {
    await expect(
      authenticateUser(
        { email: 'owner@platform.local', password: 'owner-demo-pass' },
        { ipAddress: '127.0.0.1', userAgent: 'vitest' },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_MFA_CODE', statusCode: 403 } satisfies Partial<AuthError>);
  });

  it('removes access after logout invalidation and records audit entries', async () => {
    const login = await authenticateUser(
      { email: 'admin@platform.local', password: 'admin-demo-pass', mfaCode: '000000' },
      { ipAddress: '127.0.0.1', userAgent: 'vitest' },
    );

    await invalidateSession(login.sessionId);

    await expect(getSessionFromToken(login.token)).resolves.toBeNull();
    expect((await listLoginAuditRecords())[0]?.outcome).toBe('success');
  });

  it('updates the active tenant/app context for an existing session', async () => {
    const login = await authenticateUser(
      { email: 'owner@platform.local', password: 'owner-demo-pass', mfaCode: '000000' },
      { ipAddress: '127.0.0.1', userAgent: 'vitest' },
    );

    await updateSessionContext(login.sessionId, {
      tenantId: 'tenant_acme',
      appId: 'app_market_web',
    });

    const session = await getSessionFromToken(login.token);
    expect(session?.user.tenantId).toBe('tenant_acme');
    expect(session?.user.appId).toBe('app_market_web');
  });

  it('persists sessions and login audit history when AUTH_STATE_FILE is configured', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'dashboard-auth-'));

    try {
      process.env.AUTH_STATE_FILE = join(tempDir, 'auth-state.json');
      resetDashboardEnvForTests();
      await resetAuthStateForTests();

      const login = await authenticateUser(
        { email: 'viewer@platform.local', password: 'viewer-demo-pass' },
        { ipAddress: '127.0.0.1', userAgent: 'vitest' },
      );

      await resetAuthStateForTests({ preservePersistedState: true });
      resetDashboardEnvForTests();

      const session = await getSessionFromToken(login.token);
      expect(session?.user.userId).toBe('usr_viewer');
      expect((await listLoginAuditRecords())[0]?.email).toBe('viewer@platform.local');
    } finally {
      await resetAuthStateForTests();
      resetDashboardEnvForTests();
      delete process.env.AUTH_STATE_FILE;
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});