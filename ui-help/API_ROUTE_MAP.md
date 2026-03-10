# API Route Map

> **Generated:** 2026-03-10
> **Source:** `control-plane-api/src/router.mjs`, `control-plane-api/src/handlers.mjs`, `src/app/api/`

This document maps every API endpoint in the platform. It serves as the machine-readable reference for the AI assistant's tool system and knowledge base.

---

## Control-Plane API (Port 4100)

All `/admin/*` routes require Bearer token authentication. All `/ai/*`, `/embed`, `/memory/*` routes require authentication headers (`x-tenant-id`, `x-app-id`, `x-user-id`, `x-user-roles`).

### Health & System

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `GET` | `/health` | None | — | Service health check with uptime and DB status |
| `GET` | `/admin/system` | Token | `system:write` | System configuration and section listing |

---

### Platform Overview & Analytics

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `GET` | `/admin/overview` | Token | `analytics:read` | Running agents, queue backlog, live events/min, alerts |
| `GET` | `/admin/analytics` | Token | `analytics:read` | KPI tiles, tenant growth series, tool usage by domain |
| `GET` | `/admin/market-signals` | Token | `analytics:read` | Market signal list (signal_type, direction, subject) |
| `GET` | `/admin/recommendations` | Token | `analytics:read` | Operator recommendation list (category, priority) |
| `GET` | `/admin/agent-performance` | Token | `analytics:read` | Agent performance snapshots (success rate, feedback score) |

**Query params:** `?tenant_id=`, `?app_id=`, `?limit=`, `?signal_type=`, `?direction=`, `?category=`, `?priority=`, `?agent_id=`

---

### Tenant Management (CRUD)

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `GET` | `/admin/tenants` | Token | `tenants:read` | List tenants. Supports paginated catalog queries. |
| `POST` | `/admin/tenants` | Token | `tenants:write` | Create a new tenant |
| `PATCH` | `/admin/tenants/:tenantId` | Token | `tenants:write` | Update tenant (name, status, tier, region) |

**Catalog query params:** `?page=`, `?per_page=`, `?sort=`, `?order=`, `?q=`, `?status=`

---

### App Management (CRUD)

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `GET` | `/admin/apps` | Token | `apps:read` | List apps. Supports paginated catalog queries. |
| `POST` | `/admin/apps` | Token | `apps:write` | Create a new app |
| `PATCH` | `/admin/apps/:appId` | Token | `apps:write` | Update app (name, status, runtime, environment) |

**Catalog query params:** `?page=`, `?per_page=`, `?sort=`, `?order=`, `?q=`, `?status=`, `?environment=`

---

### User Management (CRUD)

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `GET` | `/admin/users` | Token | `users:read` | List users. Supports paginated catalog queries. |
| `POST` | `/admin/users` | Token | `users:write` | Create a new user |
| `PATCH` | `/admin/users/:userId` | Token | `users:write` | Update user (name, role, status) |

**Catalog query params:** `?page=`, `?per_page=`, `?sort=`, `?order=`, `?q=`, `?status=`, `?role=`

---

### Agent Management

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `GET` | `/admin/agents` | Token | `agents:read` | List agents. Supports paginated catalog queries. |
| `POST` | `/admin/agents/:agentId/actions` | Token | `agents:operate` | Dispatch action to agent (pause, resume, restart) |

**Catalog query params:** `?page=`, `?per_page=`, `?sort=`, `?order=`, `?q=`, `?status=`, `?time_range=`

---

### Agent Orchestration (Workflows)

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `GET` | `/admin/orchestrator/workflows` | Token | `agents:read` | List orchestrator workflows |
| `POST` | `/admin/orchestrator/workflows` | Token | `agents:operate` | Schedule a new multi-agent workflow |
| `POST` | `/admin/orchestrator/workflows/:workflowId/lifecycle` | Token | `agents:operate` | Update workflow participant lifecycle (status, stage, lane) |
| `POST` | `/admin/orchestrator/workflows/:workflowId/aggregate` | Token | `agents:operate` | Aggregate completed workflow (outcome, summary, recommendations) |

**Query params:** `?status=`, `?agent_id=`, `?limit=`

---

### Research Agent

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `GET` | `/admin/research-agent/runs` | Token | `agents:read` | List research agent execution runs |
| `POST` | `/admin/research-agent/execute` | Token | `agents:operate` | Manually trigger a research agent run |
| `GET` | `/admin/research-agent/triggers` | Token | `agents:read` | List scheduled/event triggers |
| `POST` | `/admin/research-agent/triggers` | Token | `agents:operate` | Create a new trigger (schedule or event-based) |
| `POST` | `/admin/research-agent/triggers/run-due` | Token | `agents:operate` | Run all due schedule triggers |
| `POST` | `/admin/research-agent/triggers/process-events` | Token | `agents:operate` | Run all event-based triggers against recent events |

---

### Insight Agent

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `GET` | `/admin/insight-agent/runs` | Token | `agents:read` | List insight agent execution runs |
| `POST` | `/admin/insight-agent/execute` | Token | `agents:operate` | Manually trigger insight agent |
| `POST` | `/admin/insight-agent/process-events` | Token | `agents:operate` | Process platform events for market signals |

---

### Recommendation Agent

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `GET` | `/admin/recommendation-agent/runs` | Token | `agents:read` | List recommendation agent runs |
| `POST` | `/admin/recommendation-agent/execute` | Token | `agents:operate` | Generate recommendations for an agent |

---

### Feedback Loop

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `GET` | `/admin/agent-feedback/outcomes` | Token | `analytics:read` | List agent outcome records |
| `POST` | `/admin/agent-feedback/outcomes` | Token | `agents:operate` | Record an agent outcome (success/failure/warning) |

---

### Research Service

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `GET` | `/admin/research/runs` | Token | `research:read` | List research collection runs |
| `POST` | `/admin/research/collect` | Token | `research:operate` | Start a research collection job |
| `GET` | `/admin/research/schedules` | Token | `research:read` | List research schedules |
| `POST` | `/admin/research/schedules` | Token | `research:operate` | Create a recurring research schedule |
| `POST` | `/admin/research/schedules/run-due` | Token | `research:operate` | Execute all due research schedules |

---

### Tool Service

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `GET` | `/admin/tools` | Token | `tools:read` | List tool definitions with risk/schema/guards |
| `POST` | `/admin/tools/execute` | Token | `tools:read` | Execute a named tool with validated input |
| `GET` | `/admin/tools/executions` | Token | `tools:read` | List tool execution audit trail |

**Available tools:** `database.query.records`, `statistics.calculate.summary`, `market.lookup.price`, `analysis.summarize.signals`

---

### Model Management

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `GET` | `/admin/models` | Token | `models:read` | List model routing configuration |
| `POST` | `/admin/models/switch` | Token | `models:switch` | Switch active model for a routing key |

---

### Knowledge Graph

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `GET` | `/admin/knowledge-graph` | Token | `graph:read` | Get graph nodes and edges (categories, locations, vendors, listings, agents) |

**Query params:** `?tenant_id=`, `?app_id=`, `?type=`, `?layout=`

---

### Events

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `GET` | `/admin/events` | Token | `events:read` | List platform events. Supports pagination. |
| `GET` | `/admin/events/stream` | Token | `events:read` | SSE live event stream (3s interval, keepalive at 15s) |

**Query params:** `?tenant_id=`, `?app_id=`, `?event_type=`, `?limit=`

---

### Observability

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `GET` | `/admin/observability` | Token | `observability:read` | Service health + client errors. Supports pagination. |

**Query params:** `?status=`, `?q=`, `?page=`, `?per_page=`

---

### Memory Service

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `POST` | `/memory/conversations` | Headers | — | Save a conversation turn |
| `GET` | `/memory/conversations` | Headers | — | List conversation turns for a session |
| `POST` | `/memory/preferences` | Headers | — | Upsert operator preferences |
| `GET` | `/memory/preferences` | Headers | — | List operator preferences |
| `POST` | `/memory/experience` | Headers | — | Record an agent experience |
| `POST` | `/memory/retrieve` | Headers | — | Retrieve memory context (conversation, preferences, items, agent experiences) |
| `GET` | `/admin/memory` | Token | `memory:read` | List memory scopes and vector stores |

---

### AI Gateway

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `POST` | `/ai/analyze` | Headers | — | General analysis (routes to reasoning engine) |
| `POST` | `/ai/research` | Headers | — | Supply-gap research workflow |
| `POST` | `/ai/recommend` | Headers | — | Decision/recommendation workflow |
| `POST` | `/ai/command` | Headers | — | Command execution (agent runs, feedback recording) |

**Request schema:** `{ message, history[], pathname?, memoryContext?, maxRecommendations? }`
**Response schema:** `{ route, promptTemplate, message, suggestions[], reasoning, degraded, guardrails }`

---

### Embeddings

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `POST` | `/embed` | Headers | — | Chunk, embed, and persist documents |

**Request schema:** `{ items[{ text, sourceType, sourceUri?, title?, metadata? }], chunkSize?, overlap?, model?, persist? }`

---

### Audit

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| `GET` | `/admin/audit` | Token | `audit:read` | List audit log entries with filtering |

**Query params:** `?tenant_id=`, `?app_id=`, `?actor=`, `?action=`, `?resource_type=`, `?from=`, `?to=`, `?q=`

---

## Dashboard Next.js API Routes (Port 3000)

The Next.js dashboard proxies admin requests to the control-plane API and also serves:

| Path | Description |
|---|---|
| `/api/admin/*` | Proxied control-plane admin routes (agents, analytics, apps, assistant, audit, events, knowledge-graph, memory, models, observability, overview, system, tenants, tools, users) |
| `/api/auth/*` | Authentication routes (login, logout, session management) |
| `/api/health/` | Dashboard health check |
| `/api/observability/` | Dashboard-side observability |

---

## Permission Model

| Permission | Grants |
|---|---|
| `analytics:read` | Overview, analytics, market signals, recommendations, agent performance, outcomes |
| `tenants:read` / `tenants:write` | Tenant listing / tenant CRUD |
| `apps:read` / `apps:write` | App listing / app CRUD |
| `users:read` / `users:write` | User listing / user CRUD |
| `agents:read` / `agents:operate` | Agent listing / agent actions, workflow ops, agent runs |
| `tools:read` | Tool listing, execution, execution history |
| `models:read` / `models:switch` | Model listing / model switching |
| `graph:read` | Knowledge graph access |
| `events:read` | Event listing and stream |
| `observability:read` | Service health monitoring |
| `memory:read` | Memory scope listing |
| `audit:read` | Audit log access |
| `research:read` / `research:operate` | Research run listing / research collection and scheduling |
| `system:write` | System configuration |
