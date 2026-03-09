# AI Platform Control Dashboard

Production-grade starter for a **multi-tenant AI-native platform control dashboard** built with **Next.js**, **React**, and **Tailwind CSS**.

## What this starter includes

- Multi-tenant dashboard shell with login flow and route protection
- RBAC primitives for platform owners, tenant admins, ops admins, analysts, and viewers
- Full module scaffold for overview, tenants, apps, users, agents, tools, models, memory, graph, events, analytics, observability, and settings
- Example control-plane API routes under `src/app/api/admin/*`
- Mock control-plane data with typed Zod schemas for request/response validation
- Interactive modules for:
  - agent operations
  - model switching
  - live event streaming with pause/resume and reconnect handling
  - knowledge graph exploration with `@xyflow/react`

## System architecture summary

### UI architecture

- **Next.js App Router** for route-based module organization
- **Dashboard shell** separated from public login route using route groups
- **Reusable component layer** under `src/components`
- **Service layer** under `src/services` to abstract the control-plane API
- **Typed domain/contracts** under `src/types`
- **Module metadata** under `src/modules`

### Control Plane API architecture

- The dashboard is designed as a **BFF-friendly admin console**.
- It can run with:
  1. **local mock route handlers** in `src/app/api/admin/*`
  2. a **remote Control Plane API** configured through env vars
- The service layer injects `tenant_id`, `app_id`, and `user_id` headers for remote integration.

### Data flow

1. Admin authenticates into the dashboard.
2. Protected routes load server-side page data through `controlPlaneService`.
3. `controlPlaneService` either:
   - uses local mock data, or
   - calls the remote Control Plane API.
4. UI modules render normalized, typed payloads.
5. Interactive modules post actions back to `/api/admin/*` action endpoints.

### Authentication and RBAC

- Session cookie: `platform_session`
- Sessions are signed, expiration-bound cookies backed by a server-side session registry
- Local durability is available through `AUTH_STATE_FILE` for sessions and login audit history
- Local tenant/app/user management state can persist through `ADMIN_CATALOG_STATE_FILE`
- Middleware protects all dashboard routes except `/login`
- `/api/admin/*` routes enforce permissions server-side, not only in the UI
- Privileged demo accounts (`platform_owner`, `platform_admin`) require MFA using `ADMIN_MFA_TEST_CODE`
- Roles:
  - `platform_owner`
  - `platform_admin`
  - `tenant_admin`
  - `ops_admin`
  - `analyst`
  - `viewer`
- Permission mapping is implemented in `src/lib/rbac.ts`

## Project structure

```text
src/
  app/
    (dashboard)/
      page.tsx
      tenants/page.tsx
      apps/page.tsx
      users/page.tsx
      agents/page.tsx
      tools/page.tsx
      models/page.tsx
      memory/page.tsx
      knowledge-graph/page.tsx
      events/page.tsx
      analytics/page.tsx
      observability/page.tsx
      settings/page.tsx
    api/
      auth/
      admin/
    login/page.tsx
    globals.css
    layout.tsx
  components/
    dashboard/
    layout/
    ui/
  hooks/
  lib/
  mocks/
  modules/
  services/
  test/
  types/
docs/
  architecture.md
  control-plane-api.md
  database-models.md
  knowledge-layer.md
training/
  README.md
```

## Key React components

- `DashboardLayout`
- `Sidebar`
- `Topbar`
- `MetricsCards`
- `EventStream`
- `GraphExplorer`
- `AgentMonitor`
- `ToolRegistryTable`
- `TenantManager`
- `ModelMonitor`

## Local development

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start the app

```bash
pnpm dev
```

Open `http://localhost:3000/login`.

### 3. Run verification

```bash
pnpm typecheck
pnpm test
pnpm lint
```

### Demo login accounts

- `owner@platform.local` / `owner-demo-pass` / MFA `000000`
- `admin@platform.local` / `admin-demo-pass` / MFA `000000`
- `ops@platform.local` / `ops-demo-pass`
- `analyst@platform.local` / `analyst-demo-pass`
- `viewer@platform.local` / `viewer-demo-pass`

## Connecting to a real Control Plane API

Add environment variables:

```bash
SESSION_SECRET=replace_with_at_least_32_random_characters
SESSION_TTL_SECONDS=43200
SESSION_ROTATION_WINDOW_SECONDS=1800
ADMIN_MFA_TEST_CODE=000000
AUTH_STATE_FILE=.data/dashboard-auth.json
ADMIN_CATALOG_STATE_FILE=.data/dashboard-admin-catalog.json
CONTROL_PLANE_API_BASE_URL=https://control-plane.example.com
CONTROL_PLANE_API_TOKEN=replace_me
CONTROL_PLANE_STATE_FILE=.data/control-plane-state.json
NEXT_PUBLIC_CONTROL_PLANE_API_BASE_URL=https://control-plane.example.com
```

The service layer will then call remote endpoints like:

- `GET /admin/tenants`
- `GET /admin/apps`
- `GET /admin/agents`
- `GET /admin/models`
- `GET /admin/knowledge-graph`
- `GET /admin/events`
- `GET /admin/events/stream`
- `GET /admin/analytics`
- `GET /admin/system`

It forwards `x-tenant-id`, `x-app-id`, `x-user-id`, and `x-user-roles` so the remote control plane can enforce RBAC consistently.

For local standalone runs, mutable control-plane state can also persist to `CONTROL_PLANE_STATE_FILE`.
The Next.js dashboard also uses that same file for local agent/model/system mutations when `CONTROL_PLANE_API_BASE_URL` is not configured.
For local dashboard-managed tenant/app/user workflows without a remote control plane, state persists to `ADMIN_CATALOG_STATE_FILE`.

## Deploying to Cloudflare

Recommended production path:

1. Deploy the Control Plane API separately.
2. Build this dashboard as a Next.js application.
3. Use **OpenNext for Cloudflare** (`pnpm deploy:staging` / `pnpm deploy:production`).
4. Configure non-secret runtime vars in `wrangler.toml` and secrets via `wrangler secret put` or GitHub environment secrets.
5. Lock down admin routes with Cloudflare Access / Zero Trust where appropriate.
6. Follow the full Cloudflare + VPS rollout guide in `docs/deployment.md`.

## Connecting to VPS orchestration services

Recommended pattern:

- Expose only the **Control Plane API** to the dashboard
- Keep `planner-slm`, `sql-brain`, `agent-brain`, `embedding-engine`, `tool-executor`, `ai-memory`, `agent-runtime`, `platform-intelligence`, `knowledge-graph`, and `observability-api` behind private networking
- Use:
  - mTLS or service mesh auth
  - short-lived JWTs
  - firewall allowlists / private subnets / Cloudflare Tunnel

## Additional documentation

- `docs/architecture.md`
- `docs/knowledge-graph-db-evaluation.md`
- `docs/control-plane-api.md`
- `docs/database-models.md`
- `docs/knowledge-layer.md`
- `docs/deployment.md`
- `training/README.md`
- `.env.staging.example`
- `.env.production.example`

## Standalone control-plane API server

Run the separate Control Plane API service in another terminal:

```bash
pnpm control-plane:dev
```

Then point the dashboard to it with:

```bash
CONTROL_PLANE_API_BASE_URL=http://127.0.0.1:4100
NEXT_PUBLIC_CONTROL_PLANE_API_BASE_URL=http://127.0.0.1:4100
CONTROL_PLANE_API_TOKEN=local-control-plane-token
```

The standalone service lives under `control-plane-api/` and exposes the `/admin/*` contract used by the dashboard.
