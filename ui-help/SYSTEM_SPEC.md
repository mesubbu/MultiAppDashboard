# SYSTEM_SPEC

## 1. System overview

This repository implements a multi-tenant **AI Platform Control Dashboard** plus a standalone **Control Plane API**. Together they provide tenant/app administration, agent operations, model routing, knowledge storage, AI memory, observability, auditability, and operator-facing AI assistance.

### Runtime components

1. **Next.js dashboard (`src/`)**
   - Renders the operator UI.
   - Owns login/session management and middleware-based page protection.
   - Exposes `/api/auth/*` routes and a dashboard-facing `/api/admin/*` BFF layer.
   - Can run in two modes:
     - **Remote mode:** proxies to the standalone Control Plane API using a bearer token plus scope headers.
     - **Local mode:** serves data from Postgres, file-backed state, or in-memory/mock state.

2. **Standalone Control Plane API (`control-plane-api/`)**
   - Node HTTP server, default `127.0.0.1:4100`.
   - Enforces bearer-token auth and RBAC using `x-tenant-id`, `x-app-id`, `x-user-id`, and `x-user-roles` headers.
   - Exposes operational, AI, research, memory, model, event, and observability endpoints.

3. **Persistence layer**
   - Primary persistent store: **PostgreSQL**.
   - Knowledge/embedding layer uses **pgvector**.
   - When Postgres is absent, both dashboard and control plane fall back to **JSON file-backed state** under `.data/`.

4. **Deployment target**
   - Dashboard is prepared for **OpenNext on Cloudflare Workers** (`wrangler.toml`, `open-next.config.ts`).
   - Control Plane API remains a separate Node service/container.

### High-level architecture

- Operators authenticate into the dashboard.
- The dashboard resolves the operator's current tenant/app scope.
- UI modules call BFF routes under `/api/admin/*`.
- The BFF either proxies to the standalone API or serves local/state-backed responses.
- Mutations emit domain events, write audit records, and update projections used by analytics, event streams, and agent workflows.
- AI assistant, memory, research, insight, and recommendation features are backed by Control Plane API services.

## 2. Business logic

### Product purpose

The system is an operations console for a platform hosting multiple tenant applications that use AI agents, models, tools, memory, and knowledge graphs. The dashboard is not the tenant product itself; it is the **control plane** used by platform operators and tenant admins.

### Core business rules

1. **Everything is scope-aware**
   - Data is scoped by `tenantId` and usually `appId`.
   - Platform-wide users can work across tenants; tenant-scoped users are restricted to their own tenant/app.

2. **Tenants own applications**
   - A tenant has tier, region, quota, spend, health status, app count, and user count.
   - Apps belong to tenants and have runtime type, environment, region, status, and attached-agent count.

3. **Users operate within RBAC**
   - Users have one platform role and a status such as active/invited/suspended.
   - Permission checks gate both modules and API endpoints.

4. **Agents are first-class operational entities**
   - Agents belong to a tenant/app.
   - Each agent tracks queue depth, budget, budget utilization, workflow version, latency, token burn, heartbeat, orchestration stage, logs, task history, decisions, and execution history.
   - Operators can pause, restart, reroute, move stages, change budgets, retry queues, unblock dependencies, and update workflow version.

5. **Models are centrally routed**
   - The platform tracks model routes such as planner, SQL, agent, and embedding.
   - Each route has active model, fallback model, provider, latency, token usage, and error rate.
   - Authorized operators can switch the active model.

6. **Tools are governed, permissioned, and audited**
   - Tools expose schema, required permissions, risk level, execution mode, and safety guards.
   - Critical-risk tools are blocked for non-privileged users.
   - Tool execution telemetry is recorded.

7. **Knowledge and memory are platform assets**
   - Research results, documents, embeddings, graph entities, relationships, and usage patterns are persisted.
   - Conversation turns, operator preferences, and agent experiences are used as retrieval context for the assistant and AI services.

8. **AI features combine rule-based reasoning with optional model providers**
   - Local deterministic reasoning is always available.
   - Optional remote reasoning and embedding providers can be enabled via Ollama-compatible HTTP endpoints.

9. **Every important mutation is observable**
   - Catalog changes, agent actions, model switches, research runs, and AI outcomes produce audit records and/or domain events.
   - Event data feeds live streams, workflow projections, and analytics rollups.

## 3. User roles

### Implemented roles

1. **platform_owner**
   - Full read/write access across tenants, apps, users, agents, tools, models, research, memory, graph, events, analytics, observability, audit, and system settings.

2. **platform_admin**
   - Broad operational access, but no tenant creation/write and no system settings write.

3. **tenant_admin**
   - Tenant-scoped access to tenants/apps/users plus read access to agents, research, events, and audit.
   - Cannot operate agents or switch models.

4. **ops_admin**
   - Platform-wide operational role focused on agents, research, events, observability, models, and audit.

5. **analyst**
   - Read-only analytical role for analytics, events, graph, memory, models, and research.

6. **viewer**
   - Broad read-only operational visibility for tenants/apps/users/agents/tools/events.

### Demo/login accounts present in the repo

- `owner@platform.local`
- `admin@platform.local`
- `ops@platform.local`
- `analyst@platform.local`
- `viewer@platform.local`

Privileged accounts require MFA; default demo code is `000000` unless overridden.

## 4. User workflows

### 4.1 Sign in and establish scope

1. User visits `/login`.
2. Submits email, password, and MFA code.
3. Dashboard validates credentials against the auth directory, creates a signed session token, and stores server-side session state.
4. Middleware redirects authenticated users away from `/login` and protects dashboard pages.
5. User scope is resolved from role + requested tenant/app query params + active scope cookie.

### 4.2 Review platform health

1. User lands on Overview.
2. Dashboard loads overview metrics, events, models, and observability data.
3. User drills into incidents, queue backlog, active agents, service health, or event bursts.

### 4.3 Manage tenants/apps/users

1. Authorized user opens Tenants, Apps, or Users modules.
2. User filters/searches paginated catalogs.
3. Create/update actions call BFF mutation endpoints.
4. System persists the change, updates counts, writes audit data, and emits domain events.

### 4.4 Operate agents

1. User opens Agents.
2. Reviews state, queue depth, budget, task history, decisions, and logs.
3. Sends an action such as pause, restart, move stage, retry queue, unblock, reroute, update budget, or update workflow.
4. System mutates agent state, records audit data, emits `agent_action_requested`, and updates task/workflow projections.

### 4.5 Switch active model

1. Authorized user opens Models.
2. Compares latency, error rate, token burn, active/fallback candidates.
3. Sends `key + targetModel` to switch the active model.
4. System updates the registry, writes audit data, and emits `model_switched`.

### 4.6 Use the operator assistant

1. User submits a chat request from the dashboard assistant.
2. System extracts preference hints from the prompt and stores them.
3. System retrieves memory context: preferences, prior conversation turns, agent experiences, and relevant embeddings.
4. If remote AI Gateway is configured, request is routed to `/ai/recommend`, `/ai/analyze`, `/ai/research`, or `/ai/command`.
5. If remote AI fails or is absent, dashboard falls back to local assistant logic.
6. Final assistant response and tool calls are saved as a conversation turn.

### 4.7 Run research / insight / recommendation operations

1. Operator or assistant triggers a research, insight, or recommendation run.
2. Research collects data from a configured source, embeds collected documents, and persists research artifacts.
3. Insight agent consumes events, usage patterns, and research context to generate market signals.
4. Recommendation agent uses signals/behavior to produce prioritized actions.
5. Feedback loop can record outcomes and update agent performance.

### 4.8 Observe live events and audits

1. User opens Events or Audit.
2. Dashboard reads paginated event/audit data.
3. Events page can also open an SSE stream.
4. Audit page can export CSV or JSON.

### 4.9 Observability and client error review

1. User opens Observability.
2. Dashboard loads service health plus client-side UI error reports.
3. If configured, page deep-links or embeds Grafana/Loki/Prometheus views.
4. Browser-side exceptions can be POSTed to `/api/observability/client-errors`, which stores them as audit log entries.

## 5. Database entities

### Core control-plane entities

- **tenants**: id, name, tier, status, region, apps, users, monthly spend, daily event quota.
- **tenant_apps**: app records tied to tenants; runtime, environment, status, region, attached agents.
- **users**: tenant/app membership, role, status, last-seen timestamp.
- **agents**: operational runtime state, queue, budgets, performance counters, orchestration JSON, tasks/decisions/logs/execution history.
- **tool_registry**: tool metadata, schema, permissions, risk, telemetry.
- **model_registry**: route key, service, active/fallback model, provider, latency, token usage, error rate, candidates.
- **ai_memory**: scope-level memory counts, vector counts, last compaction.
- **observability_services**: service health snapshots including CPU, memory, restarts, endpoint.
- **system_settings**: keyed platform settings by section.

### Knowledge + retrieval entities

- **entities**: typed knowledge entities with external key, summary, source, confidence, metadata.
- **relationships**: links between entities with relationship type, direction, weight, evidence.
- **entity_attributes**: typed attribute key/value extensions for entities.
- **documents**: raw stored content, source type/URI, checksum, metadata.
- **embeddings**: vectorized document chunks; model, chunk index/text, dimensions, vector.
- **vector_index_map**: vector index/provider metadata.
- **graph_nodes / graph_edges**: dashboard visualization graph layer for users, vendors, categories, listings, agents, skills, locations.

### Eventing, analytics, and learning entities

- **knowledge_events**: durable domain event history.
- **events_outbox**: event payloads for downstream consumption / UI event streams.
- **audit_logs**: administrative and UI/client-error audit trail.
- **usage_patterns**: operator preferences, agent experiences, analytics signals, and other learned behavior.
- **market_signals**: insight-agent outputs.
- **agent_tasks**: projected workflow/task records tied to agents.
- **agent_performance**: success/latency/cost/feedback snapshots.

### Auth entities

- **auth_sessions**: server-side session registry keyed by session id.
- **login_audits**: login attempts with outcome, IP, user agent, and failure reason.

### Key relationships

- `tenant 1:N tenant_apps`
- `tenant 1:N users`
- `tenant_app 1:N users`
- `tenant_app 1:N agents`
- `agent 1:N agent_tasks`
- `agent 1:N agent_performance`
- `document 1:N embeddings`
- `entity 1:N entity_attributes`
- `entity N:N entity via relationships`

## 6. API endpoints

### Dashboard-authored endpoints

#### Authentication

- `POST /api/auth/login` — create session from email/password/MFA.
- `POST /api/auth/logout` — invalidate session.
- `GET /api/auth/context` — return current user/session context.

#### Health and client observability

- `GET /api/health` — dashboard health/config summary.
- `POST /api/observability/client-errors` — store browser error reports as audit records.

#### Dashboard BFF (`/api/admin/*`)

- `GET /api/admin/overview`
- `GET|POST /api/admin/tenants`
- `PATCH /api/admin/tenants/:tenantId`
- `GET|POST /api/admin/apps`
- `PATCH /api/admin/apps/:appId`
- `GET|POST /api/admin/users`
- `PATCH /api/admin/users/:userId`
- `GET /api/admin/agents`
- `POST /api/admin/agents/:agentId/actions`
- `GET /api/admin/tools`
- `GET /api/admin/models`
- `POST /api/admin/models/switch`
- `GET /api/admin/memory`
- `GET /api/admin/knowledge-graph`
- `GET /api/admin/events`
- `GET /api/admin/events/stream` — SSE proxy/local stream.
- `POST /api/admin/assistant/chat`
- `GET /api/admin/analytics`
- `GET /api/admin/observability`
- `GET /api/admin/audit`
- `GET /api/admin/audit/export?format=csv|json`
- `GET /api/admin/system`

### Standalone Control Plane API

#### Operational catalog

- `GET /health`
- `GET /admin/overview`
- `GET|POST /admin/tenants`
- `PATCH /admin/tenants/:tenantId`
- `GET|POST /admin/apps`
- `PATCH /admin/apps/:appId`
- `GET|POST /admin/users`
- `PATCH /admin/users/:userId`
- `GET /admin/agents`
- `POST /admin/agents/:agentId/actions`
- `GET /admin/tools`
- `POST /admin/tools/execute`
- `GET /admin/tools/executions`
- `GET /admin/models`
- `POST /admin/models/switch`
- `GET /admin/memory`
- `GET /admin/knowledge-graph`
- `GET /admin/events`
- `GET /admin/events/stream`
- `GET /admin/analytics`
- `GET /admin/observability`
- `GET /admin/audit`
- `GET /admin/system`

#### Agent orchestration and automation

- `GET|POST /admin/orchestrator/workflows`
- `POST /admin/orchestrator/workflows/:workflowId/lifecycle`
- `POST /admin/orchestrator/workflows/:workflowId/aggregate`
- `GET /admin/research-agent/runs`
- `POST /admin/research-agent/execute`
- `GET|POST /admin/research-agent/triggers`
- `POST /admin/research-agent/triggers/run-due`
- `POST /admin/research-agent/triggers/process-events`
- `GET /admin/insight-agent/runs`
- `POST /admin/insight-agent/execute`
- `POST /admin/insight-agent/process-events`
- `GET /admin/market-signals`
- `GET /admin/recommendation-agent/runs`
- `POST /admin/recommendation-agent/execute`
- `GET /admin/recommendations`
- `GET /admin/agent-performance`
- `GET|POST /admin/agent-feedback/outcomes`
- `GET /admin/research/runs`
- `POST /admin/research/collect`
- `GET|POST /admin/research/schedules`
- `POST /admin/research/schedules/run-due`

#### AI, embeddings, and memory

- `POST /ai/recommend`
- `POST /ai/analyze`
- `POST /ai/research`
- `POST /ai/command`
- `POST /embed`
- `GET|POST /memory/conversations`
- `GET|POST /memory/preferences`
- `POST /memory/experience`
- `POST /memory/retrieve`

### Important request payloads

- **Tenant create/update**: `name, tier, status, region, monthlySpendUsd, eventQuotaDaily`
- **App create/update**: `tenantId, name, runtime, environment, status, region, agentsAttached`
- **User create/update**: `tenantId, appId, name, role, status`
- **Agent action**: `action` plus optional `budgetUsd, workflowVersion, stage, lane, currentStage, dependencyState`
- **Model switch**: `key, targetModel`
- **Assistant chat**: `message, history, pathname`
- **Memory retrieve**: `query, sessionId, limit, conversationLimit`

## 7. External integrations

1. **PostgreSQL + pgvector**
   - Primary database for dashboard and control plane.
   - Stores structured operational data, audit/event data, and vectors.

2. **Prometheus**
   - Optional API integration for service CPU, memory, and restart metrics.
   - Used to enrich observability service records.

3. **Grafana**
   - Optional deep links and embedded dashboards on the observability page.

4. **Loki**
   - Optional deep links from observability records to logs.

5. **Ollama-compatible reasoning endpoint**
   - Optional remote generation endpoint (`/api/generate`) for reasoning/AI rewrite.

6. **Ollama-compatible embedding endpoint**
   - Optional remote embedding endpoint (`/api/embed`) for document/query embeddings.

7. **Cloudflare / OpenNext**
   - Dashboard deployment target includes Worker assets and environment-specific bindings in `wrangler.toml`.

## 8. Authentication and authorization

### Dashboard authentication

- Login is credential-based using a built-in auth directory in `src/lib/auth.ts`.
- Sessions are represented by an HMAC-signed cookie: `platform_session`.
- Claims include `sessionId`, `issuedAt`, `expiresAt`, and `rotatedAt`.
- Server-side session registry lives in Postgres (`auth_sessions`) or fallback state storage.
- Session cookies rotate near expiry.
- `platform_active_scope` stores the current tenant/app selection.

### Dashboard authorization

- Middleware protects all non-API pages except `/login`.
- Route handlers use `withPermission(...)` to enforce permissions.
- Module visibility is also permission-driven.

### Control Plane API authentication

- Every protected request requires `Authorization: Bearer <CONTROL_PLANE_API_TOKEN>`.
- Caller identity/scope is provided through headers:
  - `x-tenant-id`
  - `x-app-id`
  - `x-user-id`
  - `x-user-roles`

### RBAC model

- Permissions implemented in both dashboard and control plane:
  - `tenants:read`, `tenants:write`
  - `apps:read`, `apps:write`
  - `users:read`, `users:write`
  - `agents:read`, `agents:operate`
  - `tools:read`
  - `models:read`, `models:switch`
  - `research:read`, `research:operate`
  - `memory:read`
  - `graph:read`
  - `events:read`
  - `analytics:read`
  - `observability:read`
  - `audit:read`
  - `system:write`

## 9. Key backend services

### Dashboard-side services

- **Auth service** — login, logout, session validation, MFA enforcement, login audits.
- **Admin catalog service** — tenants/apps/users CRUD using DB or file-backed fallback.
- **Control plane service** — proxy/fallback abstraction for overview, agents, events, models, observability, audit, etc.
- **Local control-plane state service** — local-mode agent/model/event/audit state mutation.
- **AI gateway client** — dashboard-to-control-plane AI calls with circuit breaker.
- **Memory client** — dashboard-to-control-plane memory retrieval/writes.
- **Dashboard domain-event publisher** — local sink + DB persistence + projection updates.

### Control Plane API services

- **Store / Postgres store** — canonical repository abstraction for all operational data.
- **Tool service** — registry, permission checks, safe execution, telemetry.
- **Reasoning engine** — route/intention planning, tool selection, structured operator output.
- **Control-plane AI service** — command classification plus orchestration of reasoning, research, insight, recommendation, and feedback actions.
- **Embeddings service** — chunking, embedding generation, persistence of documents/vectors.
- **Memory service** — conversation history, preferences, agent experience, semantic retrieval.
- **Research service** — source collection, scheduling, embedding collected data.
- **Research agent service** — agent-specific research execution and triggers.
- **Insight agent service** — transforms events/research/usage into market signals.
- **Recommendation agent service** — produces prioritized operator recommendations.
- **Feedback loop service** — records outcomes and updates agent performance.
- **Agent orchestrator service** — multi-agent workflow scheduling, lifecycle updates, aggregation.
- **Observability enrichment** — Prometheus metric queries and threshold-based service status enrichment.

## 10. Event flows

### 10.1 Catalog mutation flow

1. Tenant/app/user create or update request is accepted.
2. Mutation is persisted.
3. Audit summary is generated.
4. Domain event such as `tenant_created`, `app_updated`, or `user_created` is published.
5. Event is written to `knowledge_events` and `events_outbox` when DB-backed.
6. Analytics projections in `usage_patterns` are updated.
7. Local fallback mode pushes the event into in-memory/file-backed event state.

### 10.2 Agent action flow

1. Operator calls agent action endpoint.
2. Agent state is mutated.
3. Audit record is written.
4. `agent_action_requested` event is published.
5. Agent-task projection is updated in `agent_tasks` when DB-backed.
6. Event becomes visible in Events/SSE and contributes to analytics.

### 10.3 Model switch flow

1. Operator requests model switch.
2. `model_registry` record is updated.
3. Audit entry is written.
4. `model_switched` event is published.

### 10.4 Research flow

1. Research request or due schedule starts a collection run.
2. Data is collected from a source (`rss`, `market_api`, `web_page`, or `platform_activity`).
3. Collected items are chunked and embedded.
4. Documents/embeddings are persisted.
5. Research run record is stored and can emit research-related events.
6. Results become available to memory retrieval, graph reasoning, insight generation, and recommendation generation.

### 10.5 Assistant memory flow

1. User sends assistant message.
2. Preferences are inferred and stored in `usage_patterns`.
3. Query embedding is generated.
4. Semantic retrieval searches embeddings plus prior conversation turns and agent experiences.
5. AI/assistant response is generated.
6. Conversation turn is embedded and persisted for future retrieval.

### 10.6 Insight / recommendation / feedback loop

1. Insight agent reads recent events, usage patterns, and research data.
2. It produces `market_signals` and stores run records.
3. Recommendation agent consumes signals/behavior and creates recommendation records.
4. Operators can record outcomes.
5. Feedback loop updates `agent_performance` and informs future assistant/recommendation behavior.

### 10.7 Live event stream flow

1. Dashboard opens `/api/admin/events/stream`.
2. In remote mode, the BFF proxies the upstream SSE response.
3. In local mode, dashboard synthesizes periodic SSE payloads from current event state plus keepalive comments.

## Rebuild guidance

To rebuild this system, implement it as two cooperating runtimes: a session-owning operator dashboard and a bearer-token-protected control-plane API. Use tenant/app scope on every record, centralize RBAC, persist domain events and audit logs, treat agents/models/tools/memory/knowledge as first-class platform resources, and preserve local fallback behavior for development when the standalone API or Postgres is unavailable.