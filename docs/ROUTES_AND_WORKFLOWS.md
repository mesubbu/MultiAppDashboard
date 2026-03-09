# Routes & Workflows Reference

## Public Routes

```
GET  /login                          → LoginPage (email/password/MFA form)
POST /api/auth/login                 → Authenticate user, create session
POST /api/auth/logout                → Invalidate session
POST /api/auth/context               → Switch tenant/app scope
```

---

## Dashboard Routes (Protected by Middleware)

### Navigation Structure
```
/                                    → Platform Overview (KPIs, alerts, health)
/tenants                             → Tenant fleet management
/apps                                → Application registry
/users                               → User directory
/agents                              → Agent orchestration + operations
/tools                               → Tool registry
/models                              → AI model routing & switching
/memory                              → Memory scopes & compaction
/knowledge-graph                     → Interactive graph explorer
/events                              → Live event stream
/analytics                           → Platform analytics & KPIs
/observability                       → Service health & monitoring
/audit                               → Compliance audit log
/settings                            → System configuration
```

---

## Admin API Routes (Protected by RBAC)

### Catalog Operations
```
GET  /api/admin/tenants              → List tenants (tenants:read)
POST /api/admin/tenants              → Create tenant (tenants:write)
PATCH /api/admin/tenants/[id]        → Update tenant (tenants:write)

GET  /api/admin/apps                 → List apps (apps:read)
POST /api/admin/apps                 → Create app (apps:write)
PATCH /api/admin/apps/[id]           → Update app (apps:write)

GET  /api/admin/users                → List users (users:read)
POST /api/admin/users                → Create user (users:write)
PATCH /api/admin/users/[id]          → Update user (users:write)
```

### Agent Operations
```
GET  /api/admin/agents               → List agents (agents:read)
POST /api/admin/agents/[id]/actions  → Agent control (agents:operate)
     Actions: pause, restart, update_budget, update_workflow, 
              move_stage, retry_queue, unblock, reroute
```

### Model Management
```
GET  /api/admin/models               → List models (models:read)
POST /api/admin/models/switch        → Switch active model (models:switch)
```

### Read-Only Endpoints
```
GET  /api/admin/tools                → Tool registry (tools:read)
GET  /api/admin/memory               → Memory scopes (memory:read)
GET  /api/admin/knowledge-graph      → Graph data (graph:read)
GET  /api/admin/events               → Event list (events:read)
GET  /api/admin/events/stream        → Live event stream (events:read)
GET  /api/admin/analytics            → Analytics data (analytics:read)
GET  /api/admin/observability        → Service health (observability:read)
GET  /api/admin/audit                → Audit logs (audit:read)
GET  /api/admin/overview             → Platform overview (analytics:read)
GET  /api/admin/system               → System settings (system:write)
```

### Assistant
```
POST /api/admin/assistant/chat       → AI copilot interaction (events:read)
```

---

## Core Workflows

### 1. Login & Session Initialization
```
User → /login page
     → POST /api/auth/login (email, password, mfaCode)
     → Validate credentials + MFA
     → Create session (JWT + file-backed store)
     → Set SESSION_COOKIE + ACTIVE_SCOPE_COOKIE
     → Redirect to /
```

### 2. Scope Switching (Tenant/App Context)
```
User clicks TenantSwitcher dropdown
     → POST /api/auth/context (tenantId, appId)
     → Validate access via resolveSessionScope()
     → Update session user context
     → Set ACTIVE_SCOPE_COOKIE
     → router.refresh() → Revalidate all data
```

### 3. Agent Control Workflow
```
User navigates to /agents
     → Fetch agents via controlPlaneService.getAgents()
     → Render AgentOrchestrationBoard (stage lanes)
     → User selects agent → AgentDashboard shows details
     → User clicks "Pause" / "Update Budget" / "Change Workflow"
     → POST /api/admin/agents/[id]/actions
     → Local state updates optimistically
     → Audit event published
```

### 4. Model Switching
```
User on /models or /overview
     → ModelMonitor shows active vs fallback models
     → User clicks "Switch to [candidate]"
     → POST /api/admin/models/switch (key, targetModel)
     → Local control plane updates model registry
     → Publishes model_switched domain event
     → Audit log recorded
```

### 5. Tenant/App Creation
```
User on /tenants or /apps (with write permission)
     → Click "Create" button
     → Fill form (name, tier, region, etc.)
     → POST /api/admin/tenants or /api/admin/apps
     → Validate payload with Zod schema
     → Create in local catalog or proxy to remote
     → Success toast + router.refresh()
```

### 6. AI Assistant Interaction
```
User types in AssistantSidebar
     → POST /api/admin/assistant/chat (message, history, pathname)
     → Extract preferences from message
     → Retrieve memory context (semantic search)
     → Route to: analyze, research, recommend, or command
     → Execute scoped admin commands (if permitted)
     → Save conversation turn to memory service
     → Return message + suggestions
```

### 7. Audit & Compliance
```
User navigates to /audit
     → Fetch audit logs via controlPlaneService.getAuditPage()
     → Filter by actor, resource, action, timestamp
     → Display in table with pagination
     → Click "Export" → Download CSV/JSON
```

---

## Permission Enforcement Points

### Route-Level
- Middleware validates session on all `/` routes
- Redirects to `/login` if no valid session

### Page-Level
- `requireCurrentSession()` in server components
- `canAccessModule()` filters sidebar navigation
- `hasPermission()` shows/hides UI elements

### API-Level
- `withPermission()` wrapper on all admin routes
- Returns 403 Forbidden if permission missing
- Logs to audit trail

### Service-Level
- `controlPlaneService` injects user context headers
- Remote API enforces RBAC server-side
- Local fallbacks apply scope filters

---

## Data Flow Architecture

```
User Browser
    ↓
Next.js Pages (Server Components)
    ↓
controlPlaneService (abstraction layer)
    ↓
┌─────────────────────────────────────┐
│ Remote Control Plane API (optional) │
│ (with tenant/app/user headers)      │
└─────────────────────────────────────┘
    ↓ (fallback if unavailable)
┌─────────────────────────────────────┐
│ Local Mock Data + File-Backed State │
│ (CONTROL_PLANE_STATE_FILE)          │
└─────────────────────────────────────┘
    ↓
React Components (Client-side rendering)
    ↓
User sees filtered, scoped data
```

---

## Session & Context Cookies

```
SESSION_COOKIE
  - Signed JWT with sessionId
  - httpOnly, Secure, SameSite=Strict
  - Rotated on each request
  - Expires: configurable (default 24h)

ACTIVE_SCOPE_COOKIE
  - JSON: { tenantId, appId }
  - Used by TenantSwitcher for UI state
  - Updated on scope switch
```

