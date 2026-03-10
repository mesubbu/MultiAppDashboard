# AI Project Context

> **Generated:** 2026-03-10
> **Purpose:** Condensed project memory for the AI assistant's knowledge base

This document provides the AI assistant with a high-level understanding of the platform — what it does, how it's built, what entities it manages, and what AI capabilities exist.

---

## What This Platform Is

**AI Platform Control Dashboard** — a multi-tenant control plane for managing AI agents, workflows, knowledge graphs, and operational intelligence. It serves as the central operations interface for a platform where AI agents perform autonomous tasks (research, recommendations, insights) across tenant-scoped applications.

**Primary users:** Platform operators and administrators who monitor agents, review recommendations, manage tenants/apps/users, and oversee system health.

---

## Core Entities

| Entity | Description |
|---|---|
| **Tenant** | An organization using the platform. Has tier (free/starter/pro/enterprise), region, status. |
| **App** | A deployed application belonging to a tenant. Has runtime, environment (dev/staging/prod), status. |
| **User** | A person within a tenant/app scope. Has roles (platform_owner, platform_admin, operator, viewer). |
| **Agent** | An autonomous AI worker. Has state (running/paused/throttled/error), queue, workflow version, orchestration stage/lane/blockers. |
| **Workflow** | A multi-agent orchestrated task with participants, stages (intake→analysis→execution→review→complete), priorities, and lifecycle tracking. |
| **Tool** | A callable capability registered in the tool service. Has schema, permissions, risk level, safety guards, and execution audit. |
| **Knowledge Graph** | A property graph of nodes (categories, locations, vendors, listings, agents) and edges representing platform relationships. |
| **Event** | A domain event (agent_triggered, analysis_completed, workflow_aggregated, etc.) used for audit and real-time monitoring. |
| **Model** | A model routing configuration mapping a service key to an active model, provider, and fallback. |
| **Memory** | Scoped memory stores with vector embeddings, conversation history, user preferences, and agent experiences. |
| **Market Signal** | A detected supply/demand signal with type, direction, confidence, and subject. |
| **Recommendation** | An AI-generated operator recommendation with category, priority, confidence, and actionable summary. |

---

## AI Capabilities (Current)

### Reasoning Engine
- **Location:** `control-plane-api/src/reasoning-engine.mjs`
- **How it works:** Intent classification (regex-based) → tool selection → parallel tool invocation → structured output builder → optional SLM rewrite via Ollama
- **Modes:** `summarize` (default), `plan` (step-by-step actions), `decide` (recommendation with confidence)
- **SLM integration:** Calls Ollama `/api/generate` when configured; falls back to local rule-based output

### AI Gateway
- **Location:** `control-plane-api/src/ai-gateway.mjs`
- **Routes:** `/ai/analyze`, `/ai/research`, `/ai/recommend`, `/ai/command`
- **Guardrails:** Max 2 concurrent requests per scope, 2400 budget units per minute
- **Events:** Publishes `analysis_completed`, `research_requested` domain events

### Tool Service
- **Location:** `control-plane-api/src/tool-service.mjs`
- **Available tools:** `database.query.records`, `statistics.calculate.summary`, `market.lookup.price`, `analysis.summarize.signals`
- **Safety:** Zod schema validation, risk levels (low/medium/high/critical), permission-checked, full audit trail

### Agent Ecosystem
- **Research Agent:** Collects and analyzes supply/demand data, supports schedule and event triggers
- **Insight Agent:** Detects market signals from platform events
- **Recommendation Agent:** Generates actionable operator recommendations with category classification

### Embeddings & Memory
- **Embeddings:** Chunking, Ollama embedding API support, deterministic hash fallback, persistence to DB
- **Memory:** Conversation history, operator preferences, agent experiences, context retrieval
- **Strategy Learning:** Prediction accuracy tracking, recommendation acceptance rates, strategy adjustments

### Feedback Loop
- Outcome recording (success/failure/warning with scores)
- Performance recomputation per agent
- Knowledge event logging for trajectory analysis

---

## Deployment Architecture

```
Internet → Cloudflare Tunnel → Nginx (reverse proxy)
                                  ↓
                    ┌─────────────┼─────────────┐
                    ↓                           ↓
              Dashboard (Next.js)      Control-Plane API (Node.js)
              Port 3000                Port 4100
                    ↓                           ↓
              ┌─────┴─────┐            ┌────────┴────────┐
              PostgreSQL   Redis       Ollama SLM        Embeddings
              Port 5432    Port 6379   Port 7201 (*)     (via Ollama)
```
*Not yet deployed with a real model image

### Docker Services
- **Core:** postgres, redis, dashboard, control-plane-api, nginx, cloudflared
- **AI (placeholder):** planner-slm, sql-brain, agent-brain, embedding-engine, memory-compactor, graph-sync, audit-forwarder, workflow-runner, moderation-runtime, notification-broker, metrics-collector

---

## Database Schema

PostgreSQL with pgvector extension. Key tables:

| Table/Area | Purpose |
|---|---|
| Tenants, Apps, Users | Multi-tenant entity management |
| Agents | AI agent state, tasks, execution history, logs, orchestration |
| Knowledge Graph | Nodes, edges, semantic relationships |
| Events | Domain event log |
| Analytics | KPIs, tenant growth, tool usage |
| Memory | Conversation turns, preferences, agent experiences, vector stores |
| Embeddings | Documents, chunks, embedding vectors (pgvector) |
| Market Signals | Supply/demand signal records |
| Recommendations | AI-generated operator recommendations |
| Agent Outcomes | Feedback loop records |
| Agent Performance | Computed performance metrics |
| Orchestrator Workflows | Multi-agent workflow state |
| Audit Logs | Full audit trail of all mutations |
| Tool Executions | Tool invocation audit records |
| Research Runs | Research collection/schedule records |
| Usage Patterns | Behavioral signal tracking |
| Knowledge Events | Knowledge layer event log |

---

## Key Design Principles

1. **Scope isolation** — All data operations filtered by `tenantId` + `appId`
2. **Permission-first** — Every operation validates RBAC permissions before execution
3. **Audit everything** — All mutations recorded in audit logs
4. **Graceful degradation** — SLM, embeddings, and AI gateway all have fallback paths
5. **Domain events** — All significant operations publish events for observability and automation
6. **Contract validation** — Zod schemas validate all API boundaries (44KB of contracts)

---

## What's NOT Built Yet

| Capability | Status |
|---|---|
| DSPy Python agent framework | Not started — no Python service |
| Real SLM deployment | Ollama integration coded but not deployed with real model |
| RAG over knowledge docs | Embeddings service exists but not wired to reasoning |
| Write/mutate tools | Tool service is read/analyze only |
| Chat-driven UI navigation | No `navigate()` action from assistant |
| DSPy prompt optimization | Blocked on DSPy service |
| RLHF/RLAIF training pipeline | Foundation present (feedback loop) but no training |
| 3 knowledge docs | `API_ROUTE_MAP.md`, `FRONTEND_ARCHITECTURE.md`, `AI_PROJECT_CONTEXT.md` (this doc) were just generated |
