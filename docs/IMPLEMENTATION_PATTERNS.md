# Implementation Patterns & Code References

## 1. RBAC Pattern

### Permission Checking
```typescript
// src/lib/rbac.ts
const rolePermissions: Record<PlatformRole, Permission[]> = {
  platform_owner: ['tenants:read', 'tenants:write', 'apps:read', ...],
  platform_admin: ['tenants:read', 'apps:read', 'apps:write', ...],
  // ... other roles
};

export function hasPermission(roles: PlatformRole[], permission: Permission) {
  return permissionsForRoles(roles).includes(permission);
}

export function canAccessModule(roles: PlatformRole[], module: DashboardModuleDefinition) {
  const requiredPermission = modulePermissionMap[module.slug];
  return requiredPermission ? hasPermission(roles, requiredPermission) : true;
}
```

### API Route Protection
```typescript
// src/app/api/admin/_helpers.ts
export function withPermission<TParams>(
  permission: Permission,
  handler: AdminRouteHandler<TParams>,
) {
  return async (request: NextRequest, context: RouteContext<TParams>) => {
    const { session, response } = await requireAdminRequest(request);
    if (!session) return response;
    
    if (!hasPermission(session.user.roles, permission)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: `Requires ${permission} permission.` } },
        { status: 403 },
      );
    }
    
    return handler(request, context);
  };
}
```

### Component-Level Checks
```typescript
// src/app/(dashboard)/agents/page.tsx
const session = await requireCurrentSession();
const canOperate = hasPermission(session.user.roles, 'agents:operate');

return (
  <AgentsBoardSection canOperate={canOperate} />
);
```

---

## 2. Scope/Context Switching Pattern

### Scope Resolution
```typescript
// src/lib/scope.ts
export function resolveSessionScope(
  user: SessionUser,
  requested: Partial<Pick<SessionUser, 'tenantId' | 'appId'>>,
  tenants: TenantRecord[],
  apps: AppRecord[],
) {
  const allowedTenantIds = new Set(
    getAccessibleTenants(user, tenants).map((t) => t.id)
  );
  const nextTenantId = requested.tenantId && allowedTenantIds.has(requested.tenantId)
    ? requested.tenantId
    : user.tenantId;

  const accessibleApps = getAccessibleApps(user, nextTenantId, apps);
  const nextAppId = requestedAppId && accessibleApps.some((a) => a.id === requestedAppId)
    ? requestedAppId
    : accessibleApps[0]?.id ?? user.appId;

  return { tenantId: nextTenantId, appId: nextAppId };
}
```

### Context Update Endpoint
```typescript
// src/app/api/auth/context/route.ts
export async function POST(request: Request) {
  const session = await getSessionFromToken(token);
  const payload = sessionContextSchema.parse(await request.json());
  const nextScope = resolveSessionScope(session.user, payload, tenantsData, appsData);
  const user = await updateSessionContext(session.sessionId, nextScope);
  
  const response = NextResponse.json({ ok: true, user });
  return setActiveScopeCookie(response, user);
}
```

### Scope Filtering
```typescript
// src/lib/scope.ts
export function getScopeFilters(scope: Pick<SessionUser, 'tenantId' | 'appId'>): ScopeFilters {
  if (scope.tenantId === PLATFORM_TENANT_ID) {
    return {}; // Platform-wide, no filters
  }
  return {
    tenantId: scope.tenantId,
    appId: scope.appId === PLATFORM_APP_ID ? undefined : scope.appId,
  };
}

export function filterScopedItems<T extends { tenantId?: string; appId?: string }>(
  items: T[],
  filters: ScopeFilters,
) {
  return items.filter((item) => {
    if (filters.tenantId && item.tenantId !== filters.tenantId) return false;
    if (filters.appId && item.appId !== filters.appId) return false;
    return true;
  });
}
```

---

## 3. Service Layer Pattern

### Abstraction with Fallbacks
```typescript
// src/services/control-plane.ts
async function fetchOrMock<T>(
  path: string,
  schema: ZodSchema<T>,
  fallback: T,
  options?: FetchOrMockOptions<T>,
): Promise<T> {
  const baseUrl = process.env.CONTROL_PLANE_API_BASE_URL;
  const sessionUser = await getCurrentSessionUser();

  if (!baseUrl) {
    // Use local fallback
    return schema.parse(await getLocal(sessionUser));
  }

  // Try remote, fall back to local
  return fetchOrMock(path, schema, fallback, options);
}

export const controlPlaneService = {
  getOverview: () =>
    fetchOrMock('/admin/overview', overviewResponseSchema, overviewData, {
      includeScopeQuery: true,
      filterFallback: filterScopedOverview,
    }),
  getAgents: () =>
    fetchOrMock('/admin/agents', agentListResponseSchema, agentsData, {
      includeScopeQuery: true,
    }),
  // ... more methods
};
```

### Request Headers Injection
```typescript
// src/services/control-plane.ts
const response = await fetch(url.toString(), {
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${process.env.CONTROL_PLANE_API_TOKEN ?? ''}`,
    'x-tenant-id': sessionUser.tenantId,
    'x-app-id': sessionUser.appId,
    'x-user-id': sessionUser.userId,
    'x-user-roles': sessionUser.roles.join(','),
  },
  next: { revalidate: 15 },
});
```

---

## 4. Mutation Pattern (POST/PATCH)

### Client-Side Mutation
```typescript
// src/components/dashboard/AgentMonitor.tsx
async function applyAction(agentId: string, payload: Record<string, string | number>) {
  setSaving(agentId);
  await fetch(`/api/admin/agents/${agentId}/actions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => undefined);

  // Optimistic update
  setLocalAgents((current) =>
    current.map((agent) => {
      if (agent.id !== agentId) return agent;
      if (payload.action === 'pause') return { ...agent, state: 'paused' };
      return agent;
    }),
  );
  setSaving(null);
}
```

### Server-Side Handler
```typescript
// src/app/api/admin/agents/[agentId]/actions/route.ts
export const POST = withPermission<{ agentId: string }>(
  adminRoutePermissions.agentActions,
  async (request: NextRequest, context) => {
    const body = agentActionRequestSchema.parse(await request.json());
    const { agentId } = await context.params;
    
    // Try remote first
    const proxied = await proxyCatalogRequest(`/admin/agents/${agentId}/actions`, context, {
      method: 'POST',
      body,
      responseSchema: agentActionResponseSchema,
    });
    if (proxied) return proxied;

    // Fall back to local
    const result = await executeLocalAgentAction(context.session.user, agentId, body);
    return NextResponse.json(agentActionResponseSchema.parse(result));
  },
);
```

---

## 5. Validation Pattern

### Zod Schemas
```typescript
// src/types/contracts.ts
export const agentActionRequestSchema = z.object({
  action: z.enum(['pause', 'restart', 'update_budget', 'update_workflow', ...]),
  budgetUsd: z.number().optional(),
  workflowVersion: z.string().optional(),
});

export const agentActionResponseSchema = z.object({
  ok: z.boolean(),
  action: z.string(),
  audit: z.object({
    id: z.string(),
    timestamp: z.string(),
    actor: z.string(),
  }),
});
```

### Request Validation
```typescript
try {
  const body = agentActionRequestSchema.parse(await request.json());
  // ... process
} catch (error) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: { code: 'INVALID_REQUEST', message: 'Invalid payload.', details: error.flatten() } },
      { status: 400 },
    );
  }
  throw error;
}
```

---

## 6. Assistant Pattern

### Intent Planning
```typescript
// src/lib/assistant.server.ts
function planIntent(message: string, history: AssistantChatMessage[], pathname?: string): AssistantIntent {
  const normalized = message.toLowerCase();
  if (/supply|demand|gap|market imbalance/.test(normalized)) return 'supply_gaps';
  if (/throttled|queue|backlog|agent/.test(normalized)) return 'throttled_agents';
  if (/observability|service|health|cpu|memory/.test(normalized)) return 'observability';
  // ... more patterns
  return 'overview';
}
```

### Tool Execution
```typescript
async function runTool<T>(
  sessionUser: SessionUser,
  toolName: AssistantToolName,
  fn: () => Promise<T>,
  summary: (payload: T) => string,
): Promise<ToolExecution<T>> {
  const permission = toolPermissionMap[toolName];
  if (!hasPermission(sessionUser.roles, permission)) {
    return {
      toolCall: { tool: toolName, permission, status: 'blocked', summary: 'Permission denied.' },
    };
  }

  try {
    const data = await fn();
    return {
      toolCall: { tool: toolName, permission, status: 'completed', summary: summary(data) },
      data,
    };
  } catch (error) {
    return {
      toolCall: { tool: toolName, permission, status: 'failed', summary: error.message },
    };
  }
}
```

---

## 7. Session Management Pattern

### Session Creation
```typescript
// src/lib/auth.ts
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
```

### Session Validation
```typescript
export async function getSessionFromToken(token: string): Promise<ActiveSession | null> {
  const validated = await validateSessionCookie(token);
  if (!validated) return null;

  const store = await getAuthStateStore();
  const stored = await store.getSession(validated.sessionId);
  if (!stored) return null;

  stored.lastSeenAt = new Date().toISOString();
  await store.upsertSession(stored);

  return {
    sessionId: validated.sessionId,
    user: stored.user,
    issuedAt: validated.issuedAt,
    expiresAt: validated.expiresAt,
    refreshedToken: validated.refreshedToken,
  };
}
```

---

## Key Files Reference

| Pattern | File | Key Functions |
|---------|------|----------------|
| RBAC | `src/lib/rbac.ts` | `hasPermission()`, `canAccessModule()` |
| Scope | `src/lib/scope.ts` | `resolveSessionScope()`, `getScopeFilters()` |
| Service | `src/services/control-plane.ts` | `fetchOrMock()`, `controlPlaneService` |
| Auth | `src/lib/auth.ts` | `createSession()`, `getSessionFromToken()` |
| Assistant | `src/lib/assistant.server.ts` | `getAssistantReply()`, `planIntent()` |
| API Helpers | `src/app/api/admin/_helpers.ts` | `withPermission()`, `requireAdminRequest()` |

