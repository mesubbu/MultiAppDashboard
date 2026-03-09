import type { SessionUser } from '@/types/platform';

import { isDashboardDatabaseConfigured, queryDashboardDb } from '@/lib/db/postgres';

export type StoredSessionRecord = {
  sessionId: string;
  user: SessionUser;
  createdAt: string;
  lastSeenAt: string;
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

type AuthStateSnapshot = {
  sessions: StoredSessionRecord[];
  loginAudits: LoginAuditRecord[];
};

type AuthStateStore = {
  getSession(sessionId: string): Promise<StoredSessionRecord | null>;
  upsertSession(session: StoredSessionRecord): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  listLoginAudits(): Promise<LoginAuditRecord[]>;
  prependLoginAudit(record: LoginAuditRecord): Promise<void>;
  clear(options?: { preservePersistedState?: boolean }): Promise<void>;
};

declare global {
  var __dashboardAuthStateStore: Promise<AuthStateStore> | undefined;
}

function createEmptyState(): AuthStateSnapshot {
  return {
    sessions: [],
    loginAudits: [],
  };
}

function trimAuditLog(entries: LoginAuditRecord[]) {
  return entries.slice(0, 50);
}

function createInMemoryAuthStateStore(): AuthStateStore {
  const state = createEmptyState();

  return {
    async getSession(sessionId) {
      return state.sessions.find((session) => session.sessionId === sessionId) ?? null;
    },
    async upsertSession(session) {
      const index = state.sessions.findIndex((item) => item.sessionId === session.sessionId);
      if (index >= 0) {
        state.sessions[index] = session;
        return;
      }

      state.sessions.push(session);
    },
    async deleteSession(sessionId) {
      const index = state.sessions.findIndex((session) => session.sessionId === sessionId);
      if (index >= 0) {
        state.sessions.splice(index, 1);
      }
    },
    async listLoginAudits() {
      return [...state.loginAudits];
    },
    async prependLoginAudit(record) {
      state.loginAudits.unshift(record);
      state.loginAudits = trimAuditLog(state.loginAudits);
    },
    async clear() {
      state.sessions = [];
      state.loginAudits = [];
    },
  };
}

function createPostgresAuthStateStore(): AuthStateStore {
  return {
    async getSession(sessionId) {
      const result = await queryDashboardDb<{
        session_id: string;
        user_json: SessionUser;
        created_at: Date;
        last_seen_at: Date;
      }>(
        `SELECT session_id, user_json, created_at, last_seen_at
         FROM auth_sessions
         WHERE session_id = $1`,
        [sessionId],
      );

      const row = result.rows[0];
      return row
        ? {
            sessionId: row.session_id,
            user: row.user_json,
            createdAt: row.created_at.toISOString(),
            lastSeenAt: row.last_seen_at.toISOString(),
          }
        : null;
    },
    async upsertSession(session) {
      await queryDashboardDb(
        `INSERT INTO auth_sessions (session_id, user_json, created_at, last_seen_at)
         VALUES ($1, $2::jsonb, $3, $4)
         ON CONFLICT (session_id)
         DO UPDATE SET user_json = EXCLUDED.user_json, last_seen_at = EXCLUDED.last_seen_at`,
        [session.sessionId, JSON.stringify(session.user), session.createdAt, session.lastSeenAt],
      );
    },
    async deleteSession(sessionId) {
      await queryDashboardDb('DELETE FROM auth_sessions WHERE session_id = $1', [sessionId]);
    },
    async listLoginAudits() {
      const result = await queryDashboardDb<{
        id: string;
        email: string;
        user_id: string | null;
        timestamp: Date;
        ip_address: string;
        user_agent: string;
        outcome: 'success' | 'failed';
        reason: string | null;
      }>(
        `SELECT id, email, user_id, timestamp, ip_address, user_agent, outcome, reason
         FROM login_audits
         ORDER BY timestamp DESC
         LIMIT 50`,
      );

      return result.rows.map((row) => ({
        id: row.id,
        email: row.email,
        userId: row.user_id ?? undefined,
        timestamp: row.timestamp.toISOString(),
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        outcome: row.outcome,
        reason: row.reason ?? undefined,
      }));
    },
    async prependLoginAudit(record) {
      await queryDashboardDb(
        `INSERT INTO login_audits (id, email, user_id, timestamp, ip_address, user_agent, outcome, reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          record.id,
          record.email,
          record.userId ?? null,
          record.timestamp,
          record.ipAddress,
          record.userAgent,
          record.outcome,
          record.reason ?? null,
        ],
      );
    },
    async clear(options = {}) {
      if (options.preservePersistedState) {
        return;
      }

      await queryDashboardDb('DELETE FROM login_audits');
      await queryDashboardDb('DELETE FROM auth_sessions');
    },
  };
}

async function createFileBackedAuthStateStore(filePath: string): Promise<AuthStateStore> {
  const [{ mkdir, readFile, rename, rm, writeFile }, { dirname, resolve }] = await Promise.all([
    import('node:fs/promises'),
    import('node:path'),
  ]);

  const resolvedPath = resolve(process.cwd(), filePath);
  let state = createEmptyState();
  let writeQueue = Promise.resolve();

  async function persist() {
    await mkdir(dirname(resolvedPath), { recursive: true });
    const tempPath = `${resolvedPath}.tmp`;
    await writeFile(tempPath, JSON.stringify(state, null, 2), 'utf8');
    await rename(tempPath, resolvedPath);
  }

  async function enqueuePersist() {
    writeQueue = writeQueue.then(() => persist());
    await writeQueue;
  }

  try {
    const raw = await readFile(resolvedPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AuthStateSnapshot>;
    state = {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      loginAudits: Array.isArray(parsed.loginAudits) ? parsed.loginAudits : [],
    };
  } catch {
    await persist();
  }

  return {
    async getSession(sessionId) {
      return state.sessions.find((session) => session.sessionId === sessionId) ?? null;
    },
    async upsertSession(session) {
      const index = state.sessions.findIndex((item) => item.sessionId === session.sessionId);
      if (index >= 0) {
        state.sessions[index] = session;
      } else {
        state.sessions.push(session);
      }

      await enqueuePersist();
    },
    async deleteSession(sessionId) {
      state.sessions = state.sessions.filter((session) => session.sessionId !== sessionId);
      await enqueuePersist();
    },
    async listLoginAudits() {
      return [...state.loginAudits];
    },
    async prependLoginAudit(record) {
      state.loginAudits = trimAuditLog([record, ...state.loginAudits]);
      await enqueuePersist();
    },
    async clear(options = {}) {
      state = createEmptyState();

      if (options.preservePersistedState) {
        return;
      }

      await rm(resolvedPath, { force: true });
    },
  };
}

export async function getServerAuthStateStore(options?: { filePath?: string }) {
  if (globalThis.__dashboardAuthStateStore) {
    return globalThis.__dashboardAuthStateStore;
  }

  globalThis.__dashboardAuthStateStore = isDashboardDatabaseConfigured()
    ? Promise.resolve(createPostgresAuthStateStore())
    : options?.filePath
      ? createFileBackedAuthStateStore(options.filePath)
      : Promise.resolve(createInMemoryAuthStateStore());

  return globalThis.__dashboardAuthStateStore;
}

export function resetServerAuthStateStoreCache() {
  globalThis.__dashboardAuthStateStore = undefined;
}