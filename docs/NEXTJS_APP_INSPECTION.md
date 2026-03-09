# Next.js Dashboard App Inspection Report

## Executive Summary
Production-grade multi-tenant AI platform control dashboard with role-based access control (RBAC), session-scoped context switching, and integrated AI assistant. Built with Next.js App Router, TypeScript, and Zod validation.

---

## 1. USER ROLES & PERMISSIONS

### Role Hierarchy (6 roles)
- **platform_owner**: Full platform access + system:write (settings)
- **platform_admin**: All read + operate permissions, no system:write
- **tenant_admin**: Tenant/app/user management + research operations
- **ops_admin**: Agent operations, research, observability, models
- **analyst**: Analytics, events, graph, memory, models (read-only)
- **viewer**: Tenants, apps, users, agents, tools, events (read-only)

### Permission Model
19 granular permissions mapped to resources:
- `tenants:read/write`, `apps:read/write`, `users:read/write`
- `agents:read`, `agents:operate`
- `tools:read`, `models:read`, `models:switch`
- `research:read/operate`, `memory:read`, `graph:read`
- `events:read`, `analytics:read`, `observability:read`, `audit:read`, `system:write`

**Implementation**: `src/lib/rbac.ts` - `rolePermissions` map + `hasPermission()` function

---

## 2. AUTHENTICATION FLOW

### Login Process
1. **POST /api/auth/login** - Email/password + optional MFA code
   - Validates against in-memory auth directory
   - MFA required for privileged accounts (owner, admin)
   - Returns signed JWT session token + audit record
   
2. **Session Storage**
   - Signed JWT in `SESSION_COOKIE` (httpOnly)
   - Session metadata in file-backed store (`AUTH_STATE_FILE`)
   - Token rotation on each request via middleware

3. **Middleware Protection** (`middleware.ts`)
   - Validates session on every request
   - Redirects unauthenticated users to `/login`
   - Auto-refreshes tokens

### Demo Accounts
```
owner@platform.local / owner-demo-pass / MFA: 000000
admin@platform.local / admin-demo-pass / MFA: 000000
ops@platform.local / ops-demo-pass
analyst@platform.local / analyst-demo-pass
viewer@platform.local / viewer-demo-pass
```

---

## 3. AUTHORIZATION MODEL

### Scope-Based Access Control
Users have **tenant_id** + **app_id** context:
- **Platform-wide**: `tenant_id='platform-root'`, `app_id='control-dashboard'`
- **Tenant-scoped**: Specific tenant, all apps
- **App-scoped**: Specific tenant + app

### Scope Switching
- **POST /api/auth/context** - Switch active tenant/app
- Validates access via `resolveSessionScope()` in `src/lib/scope.ts`
- Updates session + sets `ACTIVE_SCOPE_COOKIE`
- Enforced by `TenantSwitcher` component in sidebar

### Request Headers
Service layer injects for remote Control Plane API:
- `x-tenant-id`, `x-app-id`, `x-user-id`, `x-user-roles`

---

## 4. DASHBOARD MODULES & PAGES

### 13 Main Pages (under `src/app/(dashboard)/`)
1. **overview** - KPIs, alerts, health, models, live events
2. **tenants** - Fleet management, quotas, spend, health
3. **apps** - Runtime registry (PWA, Flutter, admin, API)
4. **users** - Cross-tenant user directory + RBAC visibility
5. **agents** - Orchestration board, task/decision logs, controls
6. **tools** - Tool registry with schemas, permissions, usage
7. **models** - Planner/SQL/agent/embedding models + switch controls
8. **memory** - Memory scopes, vector growth, compaction
9. **knowledge-graph** - Interactive graph explorer (users, vendors, listings, agents)
10. **events** - Live event stream with filters
11. **analytics** - KPIs, tenant growth, tool usage
12. **observability** - Service health, queue backlog, Prometheus/Grafana/Loki links
13. **audit** - Compliance trail with export (CSV/JSON)
14. **settings** - System configuration (security, runtime, AI, observability)

---

## 5. SERVICE LAYER

### Control Plane Service (`src/services/control-plane.ts`)
Abstraction over remote Control Plane API + local fallbacks:
- **GET endpoints**: `/admin/{tenants,apps,agents,tools,models,memory,knowledge-graph,events,analytics,observability,audit,overview,system}`
- **Fallback strategy**: Local mock data if remote unavailable
- **Circuit breaker**: Prevents cascading failures
- **Scope filtering**: Applies tenant/app filters to responses

### Key Service Methods
```typescript
controlPlaneService.getTenants()
controlPlaneService.getAgents()
controlPlaneService.getModels()
controlPlaneService.getAnalytics()
// ... etc
```

---

## 6. NOTABLE POST ACTIONS

### Catalog Mutations (Admin API)
- **POST /api/admin/tenants** - Create tenant (requires `tenants:write`)
- **PATCH /api/admin/tenants/[tenantId]** - Update tenant
- **POST /api/admin/apps** - Create app (requires `apps:write`)
- **PATCH /api/admin/apps/[appId]** - Update app
- **POST /api/admin/users** - Create user (requires `users:write`)
- **PATCH /api/admin/users/[userId]** - Update user

### Agent Operations
- **POST /api/admin/agents/[agentId]/actions** - Agent control (pause, restart, update_budget, update_workflow, move_stage, retry_queue, unblock, reroute)
  - Requires `agents:operate` permission

### Model Management
- **POST /api/admin/models/switch** - Switch active model (planner/sql/agent/embedding)
  - Requires `models:switch` permission
  - Publishes `model_switched` domain event

### Assistant Chat
- **POST /api/admin/assistant/chat** - AI copilot interaction
  - Integrates with AI Gateway (remote) or local assistant
  - Saves conversation to memory service
  - Extracts user preferences from messages

---

## 7. KEY USER WORKFLOWS

### Workflow 1: Platform Operator Overview
1. Login → Platform Overview page
2. Review KPIs, alerts, service health
3. Inspect live event stream
4. Switch models if needed
5. Drill into agents/observability for issues

### Workflow 2: Tenant Management
1. Navigate to Tenants page
2. View fleet metrics (count, spend, quotas)
3. Create/update tenant (if `tenants:write`)
4. Switch scope to tenant-specific view
5. Manage apps/users within tenant

### Workflow 3: Agent Operations
1. Navigate to Agents page
2. View orchestration board (stage lanes, dependencies)
3. Select agent from dashboard
4. Pause/restart, update budget, change workflow version
5. Review task logs and execution history

### Workflow 4: AI Assistant Copilot
1. Open assistant sidebar (right panel)
2. Ask natural language questions
3. Assistant routes to: analyze, research, recommend, or command
4. Executes scoped admin commands (if permitted)
5. Saves conversation to memory (session-scoped)

---

## 8. COMPONENT ARCHITECTURE

### Layout Components
- **DashboardLayout** - 3-column: Sidebar | Main | Assistant
- **Sidebar** - Navigation + TenantSwitcher
- **Topbar** - Breadcrumbs + active tenant/app display
- **AssistantSidebar** - Chat interface with memory persistence

### Dashboard Widgets
- **MetricsCards** - KPI tiles with delta/trend
- **EventStream** - Live event table with filters
- **ModelMonitor** - Model cards with latency/token burn
- **AgentMonitor** - Agent cards with budget/workflow controls
- **AgentOrchestrationBoard** - Stage lanes with drag-drop reroute
- **ToolRegistryTable** - Tool catalog with schemas/permissions
- **TenantManager** - Tenant CRUD + pagination
- **AppManager** - App CRUD + environment filters
- **UserManager** - User CRUD + role assignment
- **GraphExplorer** - Interactive knowledge graph (React Flow)
- **AuditLogTable** - Compliance trail with export
- **ObservabilityTable** - Service health + Grafana/Loki links

---

## 9. IMPLEMENTATION EVIDENCE

### File-Backed State
- `AUTH_STATE_FILE` - Session storage
- `CONTROL_PLANE_STATE_FILE` - Local control plane mutations
- `ADMIN_CATALOG_STATE_FILE` - Tenant/app/user catalog

### Testing
- Comprehensive test suites for auth, RBAC, scope, components
- Mock data in `src/mocks/platform-data.ts`
- Zod schemas for request/response validation

### Type Safety
- Full TypeScript with strict mode
- Zod runtime validation on all API boundaries
- Typed service layer + component props

---

## 10. DEPLOYMENT MODES

### Local Development
- Mock Control Plane API in `src/app/api/admin/*`
- File-backed state persistence
- No remote dependencies required

### Remote Integration
- `CONTROL_PLANE_API_BASE_URL` env var
- `CONTROL_PLANE_API_TOKEN` for auth
- Service layer proxies requests with tenant/app headers

### Deployment Targets
- Cloudflare Workers (via OpenNext)
- VPS/Container (Docker Compose)
- Standalone Next.js server

