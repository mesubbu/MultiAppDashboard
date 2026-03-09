# Dashboard Architecture

## 1. UI architecture

The dashboard uses a layered Next.js architecture:

- **Routing layer**: App Router pages under `src/app/(dashboard)`
- **Layout layer**: `DashboardLayout`, `Sidebar`, `Topbar`
- **Module layer**: module metadata under `src/modules/dashboard/catalog.ts`
- **Component layer**: reusable dashboard widgets under `src/components`
- **Service layer**: `src/services/control-plane.ts`
- **Domain/contracts layer**: `src/types/platform.ts` and `src/types/contracts.ts`

This keeps UI composition separate from transport logic and allows the dashboard to scale into a larger control plane frontend.

## 2. Control Plane API architecture

The dashboard talks to a **Control Plane API** that orchestrates the platform:

- Cloudflare edge services remain the platform I/O and tenant runtime surface.
- VPS orchestration services remain private and are mediated by the control plane.
- The dashboard should never call internal orchestration containers directly.

Recommended API shape:

- REST endpoints under `/admin/*`
- Authenticated with admin session + API token
- Tenant-aware headers on every request:
  - `x-tenant-id`
  - `x-app-id`
  - `x-user-id`

## 3. Data flow

```text
Admin Browser
  -> Next.js Dashboard UI
  -> Dashboard service layer
  -> Control Plane API
  -> Orchestration services / Edge services
  -> Typed response back to UI
```

Operational actions such as pausing agents or switching models should flow through:

```text
UI action
  -> POST /admin/... action endpoint
  -> Control Plane API
  -> Agent runtime / model registry / observability API
  -> audit log + response
```

## 4. Authentication and RBAC model

### Authentication

- Admin login establishes a signed session cookie.
- In production, use SSO/OIDC or enterprise IdP.
- Recommended additions:
  - MFA for privileged roles
  - session rotation
  - device-aware risk checks
  - audit logs for login and admin actions

### RBAC

Roles supported in this scaffold:

- `platform_owner`
- `platform_admin`
- `tenant_admin`
- `ops_admin`
- `analyst`
- `viewer`

Permission checks are mapped in `src/lib/rbac.ts`.

## 5. Dashboard modules

| Module | Page layout | Components | API endpoints | Database entities | Key interactions |
|---|---|---|---|---|---|
| Platform Overview | KPI strip, alerts, models, events, health | `MetricsCards`, `EventStream`, `ModelMonitor` | `/admin/overview`, `/admin/events`, `/admin/models`, `/admin/observability` | `tenants`, `tenant_apps`, `events_outbox`, `audit_logs`, `agent_runs` | inspect alerts, switch model views, filter live events |
| Tenants | summary + tenant management table | `TenantManager`, `MetricsCards` | `/admin/tenants` | `tenants`, `tenant_limits`, `tenant_billing`, `tenant_policies` | review quotas, inspect health, lifecycle planning |
| Apps | registry table + runtime summaries | `MetricsCards` | `/admin/apps` | `tenant_apps`, `deployments`, `release_channels` | inspect runtime footprint, track environment status |
| Users | directory with role/status/activity | `MetricsCards` | `/admin/users` | `users`, `profiles`, `roles`, `permissions`, `sessions` | audit access, review role assignments |
| Agents | operations cards + workflow controls | `AgentMonitor`, `MetricsCards` | `/admin/agents`, `/admin/agents/{agentId}/actions` | `agents`, `agent_runs`, `agent_tasks`, `agent_decisions`, `agent_logs` | pause, restart, change budget, edit workflow |
| Tool Registry | schema/permission/risk table | `ToolRegistryTable` | `/admin/tools` | `tool_registry`, `tool_permissions`, `tool_audit_logs`, `tool_usage_rollups` | inspect schema, review risk, usage analysis |
| AI Models | model cards + switching controls | `ModelMonitor`, `MetricsCards` | `/admin/models`, `/admin/models/switch` | `model_registry`, `model_rollups`, `model_switch_audit` | compare models, switch active model |
| AI Memory | memory registry and compaction view | `MetricsCards` | `/admin/memory` | `ai_memory`, `memory_segments`, `embedding_jobs` | inspect density, review retention and compaction |
| Knowledge Graph | graph canvas + filters | `GraphExplorer` | `/admin/knowledge-graph` | `graph_nodes`, `graph_edges`, `graph_snapshots`, `entity_embeddings` | filter node types, inspect paths |
| Events | live event dashboard with filters | `EventStream` | `/admin/events` | `events_outbox`, `event_subscriptions`, `queue_messages` | filter by tenant, app, event type |
| Analytics | KPI cards + compact charts | `MetricsCards` | `/admin/analytics` | `analytics_rollups`, `usage_facts`, `insight_snapshots` | trend analysis, domain comparison |
| Observability | health cards + service table | `MetricsCards` | `/admin/observability` | `service_health_rollups`, `queue_metrics`, `log_archives` | inspect health, queue backlog, jump to Grafana/Loki |
| System Settings | grouped global config sections | `MetricsCards` | `/admin/system` | `system_settings`, `tenant_policies`, `api_keys`, `feature_flags` | review defaults, inspect security posture |

## 6. Knowledge graph explorer design

The scaffold uses **React Flow** via `@xyflow/react`.

### Supported entities

- users
- vendors
- categories
- listings
- agents
- skills
- locations

### Graph interactions

- filter by node type
- inspect node labels and metadata
- explore edges like `searches`, `offers`, `located_in`, `monitors`, `uses`
- zoom, pan, mini-map, fit view

### Recommended production query patterns

- `GET /admin/knowledge-graph?types=user,vendor,listing`
- `GET /admin/knowledge-graph?tenant_id=...&center_id=user:123&depth=2`
- `GET /admin/knowledge-graph?path_from=agent:xyz&path_to=listing:abc`

For the current recommendation on when to stay on Postgres versus adopt Neo4j or Memgraph, see `docs/knowledge-graph-db-evaluation.md`.

## 7. Agent management design

The `AgentMonitor` UI is designed to show:

- running agents
- queue
- budgets
- decisions today
- last task
- workflow version
- heartbeat time

Supported actions in the scaffold:

- pause agent
- restart agent
- update budget
- update workflow version

## 8. Tool registry design

Each tool entry follows `domain.action.object`.

Displayed fields:

- schema
- permissions
- risk level
- usage metrics
- p95 latency
- error rate

## 9. Event stream viewer design

The event viewer supports filtering by:

- tenant
- app
- event type

Primary event types in the scaffold:

- `listing_created`
- `order_placed`
- `message_sent`
- `agent_triggered`

## 10. Observability design

The dashboard is designed to integrate with:

- **Prometheus** for metrics
- **Grafana** for dashboards
- **Loki** for logs

Suggested production pattern:

- `observability-api` aggregates service health and embeds panel URLs
- dashboard deep-links into Grafana and Loki for investigations
