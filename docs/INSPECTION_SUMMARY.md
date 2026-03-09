# Next.js Dashboard Inspection - Executive Summary

## What This App Does
Production-grade **multi-tenant AI platform control dashboard** for managing:
- Autonomous agents (orchestration, budgets, workflows)
- AI models (planner, SQL, agent, embedding with switching)
- Tenants, applications, users, and tools
- Knowledge graphs, memory, events, analytics, observability
- Compliance auditing and system settings

**Built with**: Next.js App Router, TypeScript, Zod, React Flow, Tailwind CSS

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Dashboard                         │
├─────────────────────────────────────────────────────────────┤
│  Pages (13 modules)  │  Components  │  Service Layer        │
│  - Overview          │  - Metrics   │  - Control Plane      │
│  - Tenants           │  - Tables    │  - AI Gateway         │
│  - Agents            │  - Forms     │  - Memory             │
│  - Models            │  - Graphs    │  - Fallbacks          │
│  - etc.              │  - Assistant │                       │
├─────────────────────────────────────────────────────────────┤
│  Auth Layer (Session + RBAC + Scope)                        │
├─────────────────────────────────────────────────────────────┤
│  API Routes (Admin + Auth)                                  │
├─────────────────────────────────────────────────────────────┤
│  Remote Control Plane API (optional) + Local Fallbacks      │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Findings

### 1. Authentication
- **Method**: Email/password + optional MFA
- **Storage**: Signed JWT in httpOnly cookie + file-backed session store
- **Token Rotation**: On every request via middleware
- **Demo Accounts**: 5 pre-configured accounts with different roles

### 2. Authorization (RBAC)
- **6 Roles**: platform_owner, platform_admin, tenant_admin, ops_admin, analyst, viewer
- **19 Permissions**: Granular resource-based (tenants:read/write, agents:operate, etc.)
- **Enforcement**: Route-level (middleware), page-level (server components), API-level (withPermission wrapper)
- **Scope-Aware**: Tenant/app context filters all data

### 3. Multi-Tenancy
- **Scope Types**: Platform-wide, tenant-scoped, app-scoped
- **Switching**: TenantSwitcher component → POST /api/auth/context
- **Validation**: resolveSessionScope() enforces access rules
- **Filtering**: All service calls filtered by active scope

### 4. Dashboard Modules (13 Pages)
1. Overview - KPIs, alerts, health, models, events
2. Tenants - Fleet management
3. Apps - Runtime registry
4. Users - Directory + RBAC
5. Agents - Orchestration board + controls
6. Tools - Registry with schemas
7. Models - Routing + switching
8. Memory - Scopes + compaction
9. Knowledge Graph - Interactive explorer
10. Events - Live stream
11. Analytics - KPIs + growth
12. Observability - Service health
13. Audit - Compliance trail
14. Settings - System config

### 5. Service Layer
- **Abstraction**: controlPlaneService wraps remote API + local fallbacks
- **Circuit Breaker**: Prevents cascading failures
- **Scope Filtering**: Applies tenant/app filters to responses
- **Request Headers**: Injects x-tenant-id, x-app-id, x-user-id, x-user-roles

### 6. Notable POST Actions
- **Catalog**: Create/update tenants, apps, users
- **Agents**: Pause, restart, update budget, change workflow, reroute
- **Models**: Switch active model (with audit trail)
- **Assistant**: Chat with AI copilot (scoped to user context)

### 7. AI Assistant
- **Routes**: analyze, research, recommend, command
- **Intent Planning**: NLP-based message classification
- **Tool Execution**: Scoped admin commands with permission checks
- **Memory**: Saves conversations + preferences per session

### 8. Component Architecture
- **Layout**: 3-column (Sidebar | Main | Assistant)
- **Widgets**: MetricsCards, Tables, Forms, Graphs, Orchestration Board
- **Patterns**: Server components for data fetching, client components for interactivity
- **Fallbacks**: Suspense boundaries with skeleton loaders

---

## Critical Implementation Details

### Session Management
```
Login → Create JWT + file-backed session
      → Set SESSION_COOKIE (httpOnly)
      → Set ACTIVE_SCOPE_COOKIE (tenant/app)
      → Middleware validates on every request
      → Token rotates automatically
```

### Scope Switching
```
User selects tenant/app in sidebar
      → POST /api/auth/context
      → Validate access via resolveSessionScope()
      → Update session user context
      → Set ACTIVE_SCOPE_COOKIE
      → router.refresh() revalidates all data
```

### Permission Enforcement
```
API Route: withPermission(permission, handler)
      → Requires session
      → Checks hasPermission(roles, permission)
      → Returns 403 if denied
      → Logs to audit trail
```

### Data Flow
```
Server Component → controlPlaneService.getX()
      → Try remote API (with headers)
      → Fall back to local mock data
      → Apply scope filters
      → Return to component
      → Render with Suspense fallbacks
```

---

## Deployment Modes

### Local Development
- Mock Control Plane API in `src/app/api/admin/*`
- File-backed state (AUTH_STATE_FILE, CONTROL_PLANE_STATE_FILE)
- No remote dependencies

### Remote Integration
- CONTROL_PLANE_API_BASE_URL env var
- CONTROL_PLANE_API_TOKEN for auth
- Service layer proxies with tenant/app headers

### Deployment Targets
- Cloudflare Workers (OpenNext)
- VPS/Container (Docker Compose)
- Standalone Next.js server

---

## Testing & Quality

- **Type Safety**: Full TypeScript with strict mode
- **Validation**: Zod schemas on all API boundaries
- **Tests**: Comprehensive suites for auth, RBAC, scope, components
- **Mocks**: Platform data in src/mocks/platform-data.ts
- **Error Handling**: Circuit breaker, fallbacks, user-friendly messages

---

## File Organization

```
src/
  app/
    (dashboard)/          ← 13 page modules
    api/
      auth/               ← Login, logout, context
      admin/              ← Catalog + agent operations
  components/
    dashboard/            ← Widgets (MetricsCards, Tables, etc.)
    layout/               ← DashboardLayout, Sidebar, Assistant
  lib/
    auth.ts               ← Session management
    rbac.ts               ← Permission checking
    scope.ts              ← Tenant/app context
    assistant.server.ts   ← AI copilot logic
    control-plane-*.ts    ← Service layer + fallbacks
  services/
    control-plane.ts      ← Main service abstraction
    ai-gateway.ts         ← Remote AI integration
    memory.ts             ← Memory service
  types/
    platform.ts           ← Domain types (roles, permissions, records)
    contracts.ts          ← API request/response schemas
```

---

## Key Takeaways

1. **Well-Architected**: Clear separation of concerns (auth, RBAC, scope, service, components)
2. **Production-Ready**: Error handling, fallbacks, circuit breaker, audit trails
3. **Type-Safe**: Full TypeScript + Zod validation
4. **Flexible Deployment**: Works local, remote, or hybrid
5. **User-Centric**: Intuitive UI with assistant, scope switching, permission-based visibility
6. **Scalable**: Service layer abstraction allows easy integration with remote APIs
7. **Compliant**: Audit logging, RBAC enforcement, session management

---

## Related Documentation

- `NEXTJS_APP_INSPECTION.md` - Detailed breakdown of all components
- `ROUTES_AND_WORKFLOWS.md` - Complete route map + user workflows
- `IMPLEMENTATION_PATTERNS.md` - Code patterns + references

