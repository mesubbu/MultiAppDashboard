# Control Plane API Design

This scaffold uses REST endpoints under `/admin/*`.

## Common headers

Every request should carry:

```http
x-tenant-id: platform-root
x-app-id: control-dashboard
x-user-id: usr_platform_admin
x-user-roles: platform_owner,ops_admin
authorization: Bearer <token>
```

The standalone service validates the bearer token and enforces route-level RBAC using `x-user-roles`.

## Endpoints

### GET /admin/tenants

Response:

```json
{
  "items": [
    {
      "id": "tenant_acme",
      "name": "Acme Marketplace",
      "tier": "enterprise",
      "status": "healthy",
      "region": "global",
      "apps": 4,
      "users": 1820,
      "monthlySpendUsd": 9840,
      "eventQuotaDaily": 150000
    }
  ]
}
```

### GET /admin/apps

Response fields:

- `id`
- `tenantId`
- `name`
- `runtime`
- `environment`
- `status`
- `region`
- `agentsAttached`

### GET /admin/tools

Response fields:

- `name`
- `schema[]`
- `permissions[]`
- `riskLevel`
- `usageToday`
- `p95Ms`
- `errorRate`

### GET /admin/agents

Response fields:

- `id`
- `tenantId`
- `appId`
- `name`
- `state`
- `queue`
- `budgetUsd`
- `decisionsToday`
- `workflowVersion`
- `lastTask`
- `lastHeartbeatAt`

### POST /admin/agents/{agentId}/actions

Request body:

```json
{
  "action": "update_budget",
  "budgetUsd": 450
}
```

Allowed actions:

- `pause`
- `restart`
- `update_budget`
- `update_workflow`

### GET /admin/models

Response fields:

- `key`
- `service`
- `activeModel`
- `provider`
- `fallbackModel`
- `latencyMs`
- `tokenUsage1h`
- `errorRate`
- `candidates[]`

### POST /admin/models/switch

Request body:

```json
{
  "key": "planner",
  "targetModel": "Mistral-7B-Instruct"
}
```

### GET /admin/knowledge-graph

Response:

```json
{
  "nodes": [
    {
      "id": "user:anaya",
      "type": "user",
      "label": "Anaya Patel",
      "metadata": "Buyer / tenant_acme"
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "user:anaya",
      "target": "category:farm",
      "label": "searches"
    }
  ]
}
```

### GET /admin/events

Supports future query params:

- `tenant_id`
- `app_id`
- `event_type`
- `cursor`

Returns recent control-plane and platform activity events visible to the caller scope.

### GET /admin/events/stream

Server-sent events endpoint for the live dashboard stream.

- Uses the same auth and tenant/app scope headers as the other admin routes.
- Supports `tenant_id`, `app_id`, and `event_type` filters.
- Emits `text/event-stream` frames containing JSON payloads shaped like `{ items: PlatformEvent[] }`.

### GET /admin/analytics

Returns:

- `kpis[]`
- `tenantGrowth[]`
- `toolUsageByDomain[]`

### GET /admin/system

Returns grouped global configuration sections.

## Production recommendations

- Add pagination to high-cardinality endpoints
- Add query filters for tenants, apps, time windows, and severity
- Add audit trail metadata to mutation endpoints
- Add ETags or short TTL caching for read-heavy views
- Persist audit trails for privileged mutation endpoints

## Standalone server implementation

This repository now includes a runnable standalone implementation under `control-plane-api/`.

### Local run

```bash
pnpm control-plane:dev
```

### Runtime characteristics

- Node built-in HTTP server
- Zod-validated request and response payloads
- bearer-token auth for admin endpoints
- required multi-tenant headers, including `x-user-roles`
- route-level RBAC enforcement before handlers execute
- file-backed local repository option for mock platform state via `CONTROL_PLANE_STATE_FILE`
- mutation endpoints for agent actions and model switching

### Suggested production evolution

- replace the local JSON-backed repository with D1/Postgres repositories
- integrate OIDC/JWT verification instead of static bearer auth
- add paging, rate limiting, audit persistence, and structured logging
- front the service with Cloudflare Workers or Zero Trust access policies
