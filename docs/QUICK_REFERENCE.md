# Quick Reference Guide

## User Roles & Permissions Matrix

| Role | Tenants | Apps | Users | Agents | Models | Research | Memory | Graph | Events | Analytics | Observability | Audit | System |
|------|---------|------|-------|--------|--------|----------|--------|-------|--------|-----------|---------------|-------|--------|
| platform_owner | R/W | R/W | R/W | R/O | R/S | R/O | R/O | R/O | R/O | R/O | R/O | R/O | **W** |
| platform_admin | R/O | R/W | R/O | R/O | R/S | R/O | R/O | R/O | R/O | R/O | R/O | R/O | - |
| tenant_admin | R/O | R/W | R/W | R/O | - | R/O | - | - | R/O | - | - | R/O | - |
| ops_admin | - | - | - | R/O | R/O | R/O | - | - | R/O | - | R/O | R/O | - |
| analyst | - | - | - | - | R/O | R/O | R/O | R/O | R/O | R/O | - | - | - |
| viewer | R/O | R/O | R/O | R/O | - | - | - | - | R/O | - | - | - | - |

**Legend**: R/O = Read-Only, R/W = Read/Write, R/S = Read/Switch, - = No Access

---

## Demo Login Accounts

```
Email                      Password              MFA    Role
─────────────────────────────────────────────────────────────────
owner@platform.local       owner-demo-pass       000000 platform_owner
admin@platform.local       admin-demo-pass       000000 platform_admin
ops@platform.local         ops-demo-pass         -      ops_admin
analyst@platform.local     analyst-demo-pass     -      analyst
viewer@platform.local      viewer-demo-pass      -      viewer
```

---

## Core Concepts

### SessionUser
```typescript
{
  userId: string;
  tenantId: string;           // Current scope
  appId: string;              // Current scope
  name: string;
  email: string;
  roles: PlatformRole[];      // Can have multiple roles
}
```

### Scope Types
- **Platform-wide**: tenantId='platform-root', appId='control-dashboard'
- **Tenant-scoped**: Specific tenantId, appId='control-dashboard'
- **App-scoped**: Specific tenantId + appId

### Permission Format
`resource:action` (e.g., `agents:operate`, `tenants:write`)

---

## Common Code Patterns

### Check Permission in Server Component
```typescript
import { hasPermission } from '@/lib/rbac';
import { requireCurrentSession } from '@/lib/session';

const session = await requireCurrentSession();
const canWrite = hasPermission(session.user.roles, 'agents:operate');
```

### Check Permission in API Route
```typescript
import { withPermission } from '@/app/api/admin/_helpers';
import { adminRoutePermissions } from '@/app/api/admin/permissions';

export const POST = withPermission(
  adminRoutePermissions.agentActions,
  async (request, context) => {
    // Handler code - permission already checked
  },
);
```

### Fetch Data with Scope Filtering
```typescript
import { controlPlaneService } from '@/services/control-plane';

const agents = await controlPlaneService.getAgents();
// Automatically filtered by current session scope
```

### Switch Tenant/App
```typescript
// Client-side (TenantSwitcher component)
const response = await fetch('/api/auth/context', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ tenantId: 'tenant_123', appId: 'app_456' }),
});
```

### Validate Request with Zod
```typescript
import { z } from 'zod';

const schema = z.object({
  action: z.enum(['pause', 'restart', 'update_budget']),
  budgetUsd: z.number().optional(),
});

try {
  const body = schema.parse(await request.json());
  // Use body
} catch (error) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.flatten() }, { status: 400 });
  }
}
```

---

## API Endpoint Patterns

### GET (Read-Only)
```
GET /api/admin/{resource}
  → Returns list with pagination
  → Filtered by session scope
  → Requires read permission
```

### POST (Create)
```
POST /api/admin/{resource}
  → Request body validated with Zod
  → Requires write permission
  → Returns created item + audit record
```

### PATCH (Update)
```
PATCH /api/admin/{resource}/[id]
  → Request body validated with Zod
  → Requires write permission
  → Returns updated item + audit record
```

### POST (Action)
```
POST /api/admin/{resource}/[id]/actions
  → Specific action in request body
  → Requires operate permission
  → Returns action result + audit record
```

---

## Environment Variables

```bash
# Remote Control Plane Integration
CONTROL_PLANE_API_BASE_URL=http://control-plane.internal
CONTROL_PLANE_API_TOKEN=secret-token

# Local State Persistence
AUTH_STATE_FILE=/tmp/auth-state.json
CONTROL_PLANE_STATE_FILE=/tmp/control-plane-state.json
ADMIN_CATALOG_STATE_FILE=/tmp/admin-catalog-state.json

# MFA Testing
ADMIN_MFA_TEST_CODE=000000

# Session
SESSION_SECRET=your-secret-key
SESSION_EXPIRY_HOURS=24
```

---

## File Locations

| Purpose | File |
|---------|------|
| Role definitions | `src/lib/rbac.ts` |
| Permission checking | `src/lib/rbac.ts` |
| Scope logic | `src/lib/scope.ts` |
| Session management | `src/lib/auth.ts` |
| Service abstraction | `src/services/control-plane.ts` |
| API helpers | `src/app/api/admin/_helpers.ts` |
| API permissions | `src/app/api/admin/permissions.ts` |
| Type definitions | `src/types/platform.ts` |
| Zod schemas | `src/types/contracts.ts` |
| Mock data | `src/mocks/platform-data.ts` |
| Dashboard modules | `src/modules/dashboard/catalog.ts` |

---

## Debugging Tips

### Check Session
```typescript
const session = await getCurrentSession();
console.log(session?.user); // { userId, tenantId, appId, roles, ... }
```

### Check Permissions
```typescript
import { permissionsForRoles } from '@/lib/rbac';
const perms = permissionsForRoles(user.roles);
console.log(perms); // ['tenants:read', 'apps:read', ...]
```

### Check Scope
```typescript
import { getScopeFilters } from '@/lib/scope';
const filters = getScopeFilters(user);
console.log(filters); // { tenantId: '...', appId: '...' }
```

### Test API Route
```bash
curl -X POST http://localhost:3000/api/admin/agents/agent_123/actions \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<token>" \
  -d '{"action":"pause"}'
```

---

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | No valid session | Login at /login |
| 403 Forbidden | Missing permission | Check role + permission mapping |
| 400 Bad Request | Invalid payload | Validate with Zod schema |
| 503 Service Unavailable | Circuit breaker open | Remote API down, using fallback |
| Scope mismatch | Accessing wrong tenant/app | Switch scope in TenantSwitcher |

---

## Testing Workflows

### Test Login
1. Go to http://localhost:3000/login
2. Enter: owner@platform.local / owner-demo-pass / 000000
3. Should redirect to /

### Test Scope Switching
1. Login as platform_owner
2. Open sidebar TenantSwitcher
3. Select different tenant
4. Verify data filters to that tenant

### Test Permission Denial
1. Login as viewer
2. Try to access /agents (should show read-only)
3. Try to POST to /api/admin/agents/[id]/actions (should get 403)

### Test Assistant
1. Login as platform_owner
2. Open assistant sidebar (right panel)
3. Type: "Which agents are throttled?"
4. Should execute control.read.agents tool

---

## Performance Considerations

- **Revalidation**: Service layer caches for 15 seconds
- **Suspense**: Pages use Suspense boundaries for streaming
- **Pagination**: List endpoints support cursor-based pagination
- **Circuit Breaker**: Prevents hammering failed remote API
- **Local Fallbacks**: Instant response if remote unavailable

---

## Security Checklist

- ✅ Session tokens signed + httpOnly
- ✅ RBAC enforced at route + API level
- ✅ Scope filtering on all data
- ✅ Audit logging for mutations
- ✅ Zod validation on all inputs
- ✅ CSRF protection via Next.js
- ✅ XSS prevention via React escaping
- ✅ MFA for privileged accounts

