# AG-Tasks — AI Platform Control Dashboard (Personal-Use Scope)

> Master task list derived from [AG-Status.md](./AG-Status.md)  
> Phases are ordered by deployment priority. Complete Phase 1 before deploying anywhere.
> Status checkboxes below were re-verified against the current codebase on 2026-03-09 (`pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` all passed).
> Scope update: this roadmap is now optimized for a **single-user, personal-use deployment**.
> Completed enterprise/multi-tenant work is retained as historical record, but future scope should prefer the simplest viable path.
> Default bias: **single user**, **fixed tenant/app context**, **single region**, **VPS-first deployment**, and **lightweight in-process integrations before distributed infrastructure**.

---

## Phase 1 — Production Foundation (deploy-blocking)

### 1.1 Real Authentication

> Personal-use note: auth can now stay focused on a single trusted operator login. Extra hardening already completed below is retained for history, not as a signal for more auth scope.

- [x] Choose auth provider (NextAuth.js, Clerk, or custom OIDC/JWT)
- [x] Replace the hardcoded `defaultSessionUser` with a real user lookup after login
- [x] Sign session cookies with a server-side secret; validate signature in middleware
- [x] Add session expiry, rotation, and logout cleanup
- [x] Add MFA support for privileged roles (`platform_owner`, `platform_admin`)
- [x] Store user sessions server-side (DB or KV) to allow forced invalidation
- [x] Add login audit logging (timestamp, IP, device)

### 1.2 Server-Side RBAC Enforcement

> Historical note: this section is complete and preserved for reference. For personal-use deployment, a simple authenticated admin gate is sufficient and no additional RBAC work is planned.

- [x] Create a `withPermission` middleware/wrapper for Next.js API route handlers
- [x] Enforce role+permission checks on every `/api/admin/*` route, not just UI-side
- [x] Add permission checks to the standalone control-plane-api bearer auth flow
- [x] Return `403 Forbidden` with clear messages for unauthorized access attempts
- [x] Write tests for each role against each protected endpoint

### 1.3 Persistent Database

> Personal-use note: tenant-aware schema work already completed is preserved, but no further multi-tenant scoping should drive the roadmap unless the deployment model changes.

- [x] Choose primary store: D1 (Cloudflare) for edge, Postgres for VPS, or both
- [x] Set up an ORM / query builder (Drizzle recommended for D1+Postgres portability)
- [x] Create migration files based on `docs/database-models.md` SQL schemas
- [x] Replace the control-plane-api in-memory `store.mjs` with DB-backed repositories
- [x] Seed the database with the current mock data for development parity
- [x] Add connection pooling and retry logic
- [x] Apply `tenant_id` column to all tenant-scoped tables; add RLS policies or middleware scoping

### 1.4 Cloudflare Deployment Config

- [x] Add `wrangler.toml` with D1, KV, R2, and Queues bindings
- [x] Choose deployment strategy: Cloudflare Pages (Next.js adapter) or OpenNext
- [x] Configure environment variables and secrets in Cloudflare dashboard / `wrangler.toml`
- [ ] Set up Cloudflare Tunnel for secure VPS ↔ edge communication
- [x] Add a build script that outputs the correct format for the chosen deployment target
- [ ] Test a staging deployment end-to-end
- [x] Document Cloudflare Workers migration path: which services move to edge vs stay on VPS

### 1.5 Docker & VPS Orchestration

- [x] Create `Dockerfile` for the Next.js dashboard (multi-stage build)
- [x] Create `Dockerfile` for the standalone control-plane-api
- [x] Create `docker-compose.yml` for local development (dashboard + control-plane-api + DB)
- [x] Create a separate `docker-compose.vps.yml` for the 11 AI orchestration services
- [x] Add health-check endpoints to each container
- [x] Document network topology: which services are public vs. private subnet
- [x] Add volume mounts for persistent data (DB, R2-equivalent storage, logs)
- [x] Add Redis container to `docker-compose.yml` for event bus and caching
- [x] Add NGINX reverse proxy container with TLS termination config
- [x] Define `/srv` directory structure and port allocation plan for all VPS services

### 1.6 CI/CD Pipeline

- [x] Create GitHub Actions workflow: `lint` → `typecheck` → `test` → `build`
- [x] Add a deploy job for Cloudflare Pages (staging on PR, production on main)
- [x] Add a deploy job for VPS (SSH / Docker push) for the control-plane-api
- [x] Add environment-specific `.env` management (staging vs. production secrets)
- [x] Set up production secrets management (Docker secrets or Vault) for API keys and model paths

---

## Phase 2 — Feature Completeness

### 2.1 Wire Mutation Actions (Dashboard → API)

- [x] Connect agent **pause / restart** buttons to `POST /admin/agents/{id}/actions`
- [x] Connect agent **budget update** form to the same endpoint
- [x] Connect agent **workflow version** edit to the same endpoint
- [x] Connect orchestration board actions (move_stage, retry_queue, unblock, reroute)
- [x] Connect model **switching** dropdown to `POST /admin/models/switch`
- [x] Add optimistic UI updates with rollback on failure
- [x] Show success/error toast notifications after each mutation
- [x] Add confirmation dialogs for destructive actions (pause, restart, reroute)

### 2.2 Real-Time Event Streaming

- [x] Add an SSE or WebSocket endpoint to the control-plane-api
- [x] Replace the `useLiveEventStream` client-side filter hook with a real stream consumer
- [x] Buffer and batch incoming events on the client to avoid render thrashing
- [x] Add a "pause stream" toggle for the events page
- [x] Add a reconnection strategy with exponential backoff

### 2.3 Pagination & Server-Side Filtering

- [x] Add cursor-based pagination to all list endpoints (`tenants`, `apps`, `users`, `agents`, `tools`, `events`, `memory`, `observability`)
- [x] Add query params for `tenant_id`, `app_id`, `status`, `time_range`
- [x] Update the shared dashboard table component to support pagination controls (prev / next / page size)
- [x] Add sort-by-column support to the shared dashboard table component
- [x] Update the service layer (`control-plane.ts`) to pass pagination and filter params

### 2.4 Tenant Switcher

> Historical note: this section is complete and retained for reference. For personal use, future work can assume a fixed default tenant/app context instead of extending tenant-switching behavior.

- [x] Build a `TenantSwitcher` component in the sidebar
- [x] Store the active tenant selection in a cookie or React context
- [x] Filter all `controlPlaneService` calls by the active tenant
- [x] Update the control-plane-api headers to use the selected tenant's `tenant_id`
- [x] Show tenant name and tier badge in the topbar
- [x] Add server-side multi-tenant middleware to Next.js API routes (tenant resolution + request scoping)
- [x] Enforce `tenant_id` / `app_id` isolation on all downstream service calls

### 2.5 Error Boundaries & Fallback UI

- [x] Add `error.tsx` files for each dashboard route group
- [x] Design a reusable `ErrorState` component with retry button
- [x] Wrap API calls in try/catch with user-friendly error messages
- [x] Add a global error boundary at the root layout level
- [x] Log client-side errors to an observability endpoint

### 2.6 Loading States

- [x] Add `loading.tsx` files for each dashboard route with skeleton UIs
- [x] Create reusable `LoadingSkeleton` components (card, table, graph canvas)
- [x] Use React `Suspense` boundaries for streamed dashboard data sections
- [x] Add shimmer/pulse animations to skeleton components

---

## Phase 3 — Operational Maturity

> Personal-use guidance: keep operations lean. Prefer Docker logs, Grafana, health checks, retries, and circuit breakers over enterprise controls unless real usage proves the need.

### 3.1 Observability Integration

- [x] Embed Grafana dashboard panels (iframe or API) on the observability page
- [x] Add deep links from service health cards to Grafana and Loki
- [x] Ingest Prometheus metrics from VPS containers into the observability API
- [x] Display queue backlog, container CPU/memory, and AI latency as live charts
- [x] Add configurable alerting thresholds per service

### 3.2 Audit Log UI

> Historical note: this section is complete and preserved, but it is not a forward dependency for personal-use deployment.

- [x] Create a dedicated `/audit` page in the dashboard
- [x] Display all admin actions (agent ops, model switches, config changes)
- [x] Add filters: actor, resource type, action, date range
- [x] Persist audit logs to the database (currently in-memory only)
- [x] Add CSV/JSON export for compliance reporting

### 3.3 Environment Variable Validation

- [x] Create a Zod schema for all expected `process.env` variables
- [x] Validate at app startup (both dashboard and control-plane-api)
- [x] Fail fast with clear, human-readable error messages for missing/invalid vars
- [x] Document all env vars in `.env.example` with descriptions

### 3.4 Rate Limiting & Resilience

> Historical note: abuse-focused throttling is already complete and retained for reference. For personal use, prioritize resilience mechanisms like timeouts, retries, and circuit breakers over expanded rate-limiting work.

- [x] Add rate limiting to the control-plane-api (per-token, per-IP)
- [x] Add rate limit headers (`X-RateLimit-Remaining`, `Retry-After`) to responses
- [x] Add a circuit breaker for downstream AI service calls

---

## Phase 4 — Polish & Scale

> Personal-use guidance: keep polish pragmatic. Favor correctness, maintainability, and useful operator UX over public-product requirements.

### 4.1 Expanded Test Coverage

- [x] Add React Testing Library component tests for all dashboard components
- [x] Add API contract tests validating request/response shapes against Zod schemas
- [x] Set up code coverage reporting
- [x] Enforce an initial minimum coverage threshold

### 4.2 Accessibility (a11y)

> Historical note: completed accessibility work is retained, but no further a11y expansion is planned unless the dashboard becomes shared with other users.

- [x] Add ARIA labels to all interactive elements (buttons, inputs, tables, graphs)
- [x] Ensure full keyboard navigation across all pages
- [x] Add focus indicators and skip-to-content links
- [x] Run axe-core or Lighthouse accessibility audits and fix flagged issues

### 4.4 Knowledge Graph Enhancements

- [x] Add server-side path query API (`GET /admin/knowledge-graph?path_from=...&path_to=...`)
- [x] Support depth-limited subgraph extraction centered on a node
- [x] Add graph layout algorithms (force-directed, hierarchical) beyond the current radial layout
- [x] Allow saving graph presets per user
- [x] Evaluate dedicated graph DB (Neo4j / Memgraph) when relationship query complexity warrants it

### 4.5 AI Assistant Integration

- [x] Embed a sidebar chat widget powered by the planned LLM (ref: `training/Combined.md`)
- [x] Connect the assistant to control-plane API for function calling (read-only initially)
- [x] Support natural language queries like "show supply gaps" or "which agents are throttled"
- [x] Add conversation history and context memory for the assistant session

### 4.6 Code Cleanup & DX

- [x] Fix the 3 lint warnings in `AgentOrchestrationBoard.tsx` (unused variables)
- [x] Remove or integrate the `training/` folder (currently orphaned)
- [x] Add `CONTRIBUTING.md` with setup instructions and coding conventions
- [x] Add pre-commit hooks (Husky) for lint, typecheck, and formatting

---

## Phase 5 — AI Services & Knowledge Layer

> Source: [ClaudeArch.md](./ClaudeArch.md) — unified architecture recommendations.
> Personal-use guidance: start with the smallest useful implementation on the VPS. Split into dedicated services only when load, isolation, or deployment ergonomics clearly justify it.

### 5.1 Knowledge Layer Schema

- [x] Create the core knowledge-layer tables in PostgreSQL (start with the minimum useful subset, then expand toward the 12-table design only as needed):
  - Knowledge Graph: `entities`, `relationships`, `entity_attributes`
  - Vector Knowledge: `documents`, `embeddings`, `vector_index_map`
  - Agent Intelligence: `agents`, `agent_tasks`, `agent_performance`
  - Platform Intelligence: `usage_patterns` (or a simplified `user_behavior_patterns` table for single-user sessions), `market_signals`, `knowledge_events`
- [x] Install and configure `pgvector` extension for PostgreSQL
- [x] Create Drizzle migration scripts for all knowledge-layer tables
- [x] Define and document the 3-layer architecture diagram (Application → Intelligence → Knowledge)

### 5.2 Event Bus

- [x] Start with simple function calls or a lightweight in-process event dispatcher before introducing Redis Streams / BullMQ
- [x] Define domain event schema (e.g. `research_requested`, `analysis_completed`, `signal_detected`, `search_performed`)
- [x] Create event publisher utility for Next.js API routes and control-plane-api
- [x] Create lightweight subscriber hooks for agent and analytics workflows

### 5.3 AI Gateway

- [x] Build the AI Gateway service (Python/FastAPI or Node): central entry point for all AI requests
- [x] Implement request routing, prompt template management, and lightweight concurrency / budget guards
- [x] Expose REST endpoints (`POST /ai/recommend`, `POST /ai/analyze`, `POST /ai/research`)
- [x] Add circuit breaker and graceful degradation (cached/fallback responses)
- [x] Connect Next.js application to AI Gateway endpoints

### 5.4 Reasoning Engine

- [x] Build the Reasoning Engine service: integrate Mistral / Llama 3 via llama.cpp or Ollama
- [x] Support summarisation, planning, decision making, and structured output generation
- [x] Add tool invocation capability (calls Tool Service for data retrieval)

### 5.5 Embeddings Service

- [x] Build the Embeddings Service: integrate bge-small / gte-small model
- [x] Expose `/embed` endpoint for text → vector conversion
- [x] Write embeddings to pgvector; support batch embedding operations

### 5.6 Memory Service

- [x] Build the Memory Service: store and retrieve conversation history, user preferences, agent experience
- [x] Integrate with knowledge-layer tables (`documents`, `embeddings`, `usage_patterns` or simplified session history tables)
- [x] Support semantic retrieval for long-term AI context and operator-specific recommendations

### 5.7 Tool Service

- [x] Build the Tool Service: implement `domain.action.object` naming convention
- [x] Create tool registry with schema validation, safety guards, and execution logging
- [x] Add tools: database queries, statistical calculations, market price lookup, analysis functions

### 5.8 Agent Orchestrator Service

- [x] Build the Agent Orchestrator: task scheduling, agent lifecycle management
- [x] Support multi-agent workflows and result aggregation
- [x] Wire agents to lightweight event hooks first; introduce Redis / BullMQ triggers only if scale demands it

### 5.9 Research Service

- [x] Build the Research Service: external data collection (RSS feeds, market APIs, web scraping)
- [x] Write collected data to `documents`, `embeddings`, and `knowledge_events` tables
- [x] Add scheduling for periodic data collection runs

---

## Phase 6 — AI Agents & Advanced Intelligence

> Personal-use guidance: prioritize agents that directly improve your own workflow, research throughput, and decision quality. Treat broader marketplace/compliance-style intelligence as out of scope.

### 6.1 Research Agent

- [x] Implement Research Agent: collect external data via Research Service
- [x] Write findings to `documents` + `embeddings` + `knowledge_events`
- [x] Trigger on scheduled cron and relevant domain events

### 6.2 Insight Agent

- [x] Implement Insight Agent: detect market signals, demand spikes, and usage trends
- [x] Write outputs to `market_signals` + `knowledge_events`
- [x] Consume platform events for pattern detection

### 6.3 Recommendation Agent

- [x] Implement Recommendation Agent: embeddings similarity + knowledge graph + signals + behaviour
- [x] Produce operator-facing recommendations (research leads, prioritized actions, workflow suggestions)
- [x] Integrate with AI Gateway for application consumption

### 6.5 Strategy Learning Agent

- [ ] Implement Strategy Learning Agent: track agent success rates and prediction accuracy
- [ ] Update `agent_performance` and `knowledge_events` to enable self-improvement
- [ ] Feed outcomes back into Reasoning Engine context

### 6.6 Self-Learning Feedback Loop

- [x] Implement the feedback cycle: Agent action → Outcome recorded → Knowledge layer updated → Future reasoning improved
- [x] Add agent outcome tracking and scoring across all agents
- [x] Create dashboard metrics for agent improvement over time

### 6.7 Control Plane AI Interface

- [x] Build Control Plane service: natural-language admin commands routed through AI stack
- [x] Support commands like "summarize system health", "show supply gaps", "prioritize next actions"
- [x] Route through Planner → Tool Executor → Platform Services pipeline

---

## Quick Reference — Priority Matrix (Personal Use)

| Priority                  | Tasks                                                                                      | Est. Effort |
| ------------------------- | ------------------------------------------------------------------------------------------ | ----------- |
| 🔴 **P0 — Must ship**     | 1.1 – 1.6 (auth, DB, deploy, Docker, CI/CD; completed RBAC/history retained)               | ~3–4 weeks  |
| 🟡 **P1 — Core features** | 2.1 – 2.6 (mutations, real-time, pagination, errors, loading; tenant history retained)     | ~2–3 weeks  |
| 🔵 **P2 — Ops maturity**  | 3.1 – 3.4 (observability, env validation, lightweight resilience; audit history retained)   | ~1–2 weeks  |
| 🟢 **P3 — Polish**        | 4.1, 4.2, 4.4 – 4.6 (tests, graph, AI assistant, DX; a11y history retained)                | ~2–3 weeks  |
| 🟣 **P4 — AI platform**   | 5.1 – 5.9 (lean knowledge layer, eventing, AI services)                                    | ~3–4 weeks  |
| ⚪ **P5 — AI agents**     | 6.1 – 6.3, 6.5 – 6.7 (optional agents, self-learning, control plane AI)                    | ~2–3 weeks  |
