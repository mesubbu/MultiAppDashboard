# SLM + DSPy — Updated Gap Analysis & Implementation Fix List

> **Date:** 2026-03-10
> **Based on:** [SLM+DsPy.md](file:///home/subbu/Downloads/Projects/0MultiAppHosting/SLM+DsPy.md) plan vs. current codebase
> **Supersedes:** [SLM_DsPy_Gap_Analysis.md](file:///home/subbu/Downloads/Projects/0MultiAppHosting/SLM_DsPy_Gap_Analysis.md) (2026-03-09)

---

## Executive Summary — What Changed

The original gap analysis (March 9) stated **"The current build has none of the SLM+DSPy architecture implemented."** That assessment is **now out of date**. Significant progress has been made in the control-plane API and dashboard since that document was written:

| Area | March 9 Assessment | Actual Current Status |
|---|---|---|
| SLM deployment | 🔴 No SLM anywhere | ✅ **Deployed** — `ollama/ollama:latest` in `docker-compose.vps.yml` with auto-pull `mistral:7b-instruct`, GPU reservation, healthcheck, volume persistence |
| Knowledge documents | 🔴 0 of 5 exist | ✅ **6 of 6 exist** — added `API_ROUTE_MAP.md` (55 endpoints), `FRONTEND_ARCHITECTURE.md`, `AI_PROJECT_CONTEXT.md` |
| Reasoning engine | 🔴 Only regex | ✅ **RAG-augmented** — reasoning engine now retrieves top-5 knowledge chunks via cosine similarity before SLM calls |
| AI Gateway | 🔴 Not implemented | ✅ **Fully wired** — `ai-gateway.mjs` routes analyze/research/recommend/command with budget guardrails, concurrency limits, circuit breaker |
| Embeddings service | 🔴 Not started | ✅ **RAG-ready** — `retrieveContext()` + `embedKnowledgeDocs()` with checksum dedup added to `embeddings-service.mjs` |
| Tool service | 🟡 16 read tools only | ✅ **8 tools** — added 4 write/mutate tools: `entity.create.record`, `entity.update.record`, `agent.execute.action`, `agent.record.feedback` |
| Feedback / learning | 🟠 Future | 🟡 **Built** — `feedback-loop.mjs` + `strategy-learning.mjs` record outcomes, compute performance, and suggest strategy adjustments |
| Agent orchestration | Not assessed | ✅ **Workflow orchestration** — `agent-orchestrator.mjs` handles schedule/update/aggregate lifecycle |
| Dashboard ↔ API bridge | Not assessed | ✅ **Wired** — `src/services/ai-gateway.ts` calls control-plane API with circuit breaker |
| DSPy framework | 🔴 Critical | 🔴 **Still absent** — no Python DSPy infrastructure |
| Navigate capability | 🟡 Major | ✅ **Implemented** — `assistant.navigate` tool with 20-page route map, auto-navigation via `window.location.href` |

**Bottom line:** Phases A, B, and D are complete. The remaining gaps are: DSPy Python service (Phase C), dynamic tool discovery (D2), and DSPy optimization/RL (Phase E).

---

## Updated Gap Matrix

| # | Requirement | Current State | Updated Severity |
|---|---|---|---|
| 1 | **SLM reasoning model** | ✅ Ollama deployed in Docker with `mistral:7b-instruct`, auto-pull, GPU reservation, healthcheck | ✅ **Done** |
| 2 | **DSPy agent framework** | Zero Python infrastructure. Only `training/em&kg.py` exists. | 🔴 **Critical — not started** |
| 3 | **DSPy modules** (`IntentClassifier`, `ActionSelector`, `ToolInvoker`, `ResponseFormatter`) | TypeScript equivalents exist: `planIntent()`, `selectTools()`, `invokeTool()`, `buildStructuredOutput()`. | 🟡 **Partial — needs DSPy port** |
| 4 | **Knowledge documents** | ✅ 6 of 6 exist: `SYSTEM_SPEC.md`, `UI_BLUEPRINT.md`, `UI_WIREFRAME_SPEC.md`, `API_ROUTE_MAP.md`, `FRONTEND_ARCHITECTURE.md`, `AI_PROJECT_CONTEXT.md` | ✅ **Done** |
| 5 | **Tool system with CRUD** | ✅ 8 tools: 4 read/analyze + 4 write/mutate (`entity.create.record`, `entity.update.record`, `agent.execute.action`, `agent.record.feedback`) | ✅ **Done** |
| 6 | **Python tool executor** | All execution in TypeScript/Node.js. No Python executor. | 🟡 **Major** (deferred until DSPy) |
| 7 | **Chat/command interface** | ✅ Chat sidebar, AI gateway routes, conversation history. | ✅ **Done** |
| 8 | **UI navigation via assistant** | ✅ `assistant.navigate` tool with 20-page route map, intent detection, auto-navigation | ✅ **Done** |
| 9 | **DSPy prompt optimization** | Not applicable — DSPy absent. | 🔴 **Blocked on Gap 2** |
| 10 | **RL pipeline** | Feedback loop + strategy learning services exist as foundation. No actual RL/RLHF training. | 🟠 **Foundation present** |
| 11 | **Embeddings / RAG pipeline** | ✅ `retrieveContext()` with cosine similarity + `embedKnowledgeDocs()` wired into reasoning engine SLM prompts | ✅ **Done** |
| 12 | **SLM in Docker** | ✅ `ollama/ollama:latest` with `mistral:7b-instruct` auto-pull, healthcheck, GPU reservation | ✅ **Done** |

---

## Existing Strengths (No Action Needed)

These components are fully built and align with the SLM+DSPy vision:

- ✅ **AI Gateway** (`ai-gateway.mjs`) — analyze/research/recommend/command routes with budget guardrails
- ✅ **Reasoning Engine** (`reasoning-engine.mjs`) — intent → tools → structured output → optional SLM rewrite
- ✅ **Dashboard ↔ API bridge** (`src/services/ai-gateway.ts`) — circuit breaker, error handling, session auth
- ✅ **Chat Sidebar UI** — conversation history, tool-call rendering, suggestions
- ✅ **Tool naming convention** (`domain.action.object`) — already standardized
- ✅ **Permission-guarded tool execution** — RBAC on every tool call
- ✅ **Memory service** (`memory-service.mjs`) — preferences, conversation context, agent experiences
- ✅ **Feedback loop** (`feedback-loop.mjs`) — outcome recording, performance metrics
- ✅ **Strategy learning** (`strategy-learning.mjs`) — prediction accuracy, category performance, strategy adjustments
- ✅ **Agent orchestrator** (`agent-orchestrator.mjs`) — workflow schedule/update/aggregate
- ✅ **Embeddings service** (`embeddings-service.mjs`) — chunking, Ollama embedding API, persistence
- ✅ **Domain events** — AI event publishing from gateway
- ✅ **Docker topology** — private network, secrets management, placeholder AI services

---

## Implementation Fix List

### Phase A — Quick Wins ✅ COMPLETE

#### A1. Generate Missing Knowledge Documents ✅

> **Status:** ✅ Complete

Created all 3 missing documents:
- [x] **`API_ROUTE_MAP.md`** — 55 endpoints, 16 groups, methods, permissions, query parameters, request/response schemas
- [x] **`FRONTEND_ARCHITECTURE.md`** — Directory structure, components, data flows, patterns, build commands
- [x] **`AI_PROJECT_CONTEXT.md`** — Entities, AI capabilities, deployment architecture, what's not built yet

---

#### A2. Deploy Ollama SLM in Docker ✅

> **Status:** ✅ Complete

- [x] Replaced `ghcr.io/example/planner-slm:latest` with `ollama/ollama:latest`
- [x] Added entrypoint that auto-pulls `mistral:7b-instruct` on startup
- [x] Set config env vars: `REASONING_PROVIDER=ollama`, `REASONING_API_URL=http://planner-slm:11434`, `REASONING_MODEL=mistral:7b-instruct`
- [x] Set embedding env vars: `EMBEDDING_PROVIDER=ollama`, `EMBEDDING_API_URL=http://planner-slm:11434`
- [x] Added healthcheck, GPU resource reservation (`deploy.resources`), and volume persistence
- [x] Added `depends_on: planner-slm` to control-plane-api service

---

#### A3. Add Navigate Capability to Assistant ✅

> **Status:** ✅ Complete

- [x] Added `assistant.navigate` to `AssistantToolName` in `platform.ts` and `contracts.ts`
- [x] Added `NAVIGATION_MAP` (20 pages) and `resolveNavigationTarget()` in `assistant.server.ts`
- [x] Added navigate intent detection in `planAssistantGatewayRoute()` and `planIntent()`
- [x] Handle `navigate` tool calls in `AssistantSidebar.tsx` with `window.location.href` auto-navigation
- [x] Added tool label mapping in `getAssistantToolLabel()`

---

### Phase B — RAG Pipeline Over Knowledge Docs ✅ COMPLETE

#### B1. Embed Knowledge Documents into Vector Store ✅

> **Status:** ✅ Complete

- [x] Added `embedKnowledgeDocs(filePaths, adminContext)` to `embeddings-service.mjs`
- [x] Reads files, chunks (800 chars, 100 overlap), embeds via Ollama or hash fallback
- [x] Stores with `sourceType: 'knowledge_doc'` and `sourceUri` pointing to each file
- [x] Checksum-based dedup: skips unchanged docs on re-embedding

---

#### B2. Add Retrieval Step to Reasoning Engine ✅

> **Status:** ✅ Complete

- [x] Added `retrieveContext(query, { topK, sourceType })` with cosine similarity search
- [x] Wired `embeddingsService` through: `handlers.mjs` → `ai-gateway.mjs` → `reasoning-engine.mjs`
- [x] Reasoning engine retrieves top-5 knowledge chunks before building SLM prompt
- [x] Injected as: `"Platform knowledge (use as context for your response): [title] snippet..."`
- [x] RAG retrieval failure is non-fatal — degrades gracefully
- [x] Added `ragChunksUsed` to execution result for observability

---

### Phase C — DSPy Integration (New Python Service)

#### C1. Create Python DSPy Service Scaffold

> **Priority:** Medium | **Effort:** 2–3 days | **Blocked by:** A2 (Ollama must be running)

- [ ] Create `services/dspy-agent/` directory with `pyproject.toml`, `Dockerfile`, FastAPI app
- [ ] Install DSPy, configure it to use the Ollama endpoint as LM backend
- [ ] Define DSPy `Signature` classes for:
  - `IntentClassifier(user_message, context → intent, confidence)`
  - `ActionSelector(intent, available_tools, context → selected_tools, parameters)`
  - `ResponseFormatter(raw_data, user_message, mode → formatted_response)`
- [ ] Expose `/reason` endpoint: accepts `{message, history, context}`, returns `{intent, tools, response}`
- [ ] Add health check at `/health`
- [ ] Add service to `docker-compose.vps.yml` on private network

**Verification:** `POST /reason` with a test message returns structured intent + tool selection from DSPy pipeline.

---

#### C2. Bridge Reasoning Engine to DSPy Service

> **Priority:** Medium | **Effort:** 1–2 days | **Blocked by:** C1

- [ ] Add new reasoning provider `dspy` alongside existing `ollama` and `local-rules`
- [ ] When `dspy` provider is enabled, `reasoning-engine.mjs` calls DSPy `/reason` instead of running local `planIntent()` + `selectTools()`
- [ ] Keep local rules as fallback when DSPy service is unavailable (same pattern as Ollama fallback)
- [ ] Pass tool execution results back to DSPy for response formatting

**Verification:** With DSPy service running, reasoning engine uses DSPy for intent classification and gets richer responses. Falls back gracefully when service is down.

---

### Phase D — Expand Tool Coverage (Partially Complete)

#### D1. Add Write/Mutate Tools ✅

> **Status:** ✅ Complete

Added 4 write/mutate tools to `tool-service.mjs`:
- [x] `entity.create.record` — Create tenant/app/user (riskLevel: high)
- [x] `entity.update.record` — Update tenant/app/user by ID (riskLevel: high)
- [x] `agent.execute.action` — Pause/restart/budget agents (riskLevel: critical, requires privileged role)
- [x] `agent.record.feedback` — Record agent outcomes with score (riskLevel: medium)
- [x] All tools have: Zod schema validation, permission checks, execution audit trail, safety guards
- [x] Added `'write'` to `ToolExecutionMode` type in `platform.ts`

---

#### D2. Dynamic Tool Discovery from Registry

> **Priority:** Low | **Effort:** 1–2 days | **Blocked by:** D1

- [ ] Move tool definitions from hardcoded arrays to a DB table or JSON config file
- [ ] Tool service loads definitions on startup and caches them
- [ ] Add admin endpoint to register/update tool definitions
- [ ] DSPy ActionSelector discovers available tools at runtime from registry

**Verification:** Adding a new tool definition to the registry makes it available to the AI gateway without code deployment.

---

### Phase E — Learning & Optimization

#### E1. DSPy Prompt Optimization

> **Priority:** Low | **Effort:** 2–3 days | **Blocked by:** C1 (DSPy service must exist)

- [ ] Collect examples of successful `(intent → tool_selection → result)` flows from feedback loop
- [ ] Format as DSPy training examples
- [ ] Use DSPy `BootstrapFewShot` or `MIPROv2` optimizer to tune the pipeline
- [ ] Store optimized prompts and compare performance metrics

**Verification:** Optimized DSPy pipeline shows improved intent classification accuracy over baseline.

---

#### E2. Agent Trajectory Logging for RL

> **Priority:** Low | **Effort:** 1–2 days | **Blocked by:** Existing feedback loop (done)

The feedback loop and strategy learning services already exist. Extend them:
- [ ] Log full trajectories: `(user_request → reasoning → tool_calls → outcomes)` to `knowledge_events` table
- [ ] Add trajectory export endpoint for offline analysis
- [ ] Design reward signal: combine feedback score + task success + latency
- [ ] Wire trajectory data into `strategy-learning.mjs` for richer strategy adjustments

**Verification:** Knowledge events table has full trajectory records. Strategy learning uses trajectory signals.

---

#### E3. RLHF / RLAIF Fine-Tuning Pipeline

> **Priority:** Future | **Effort:** 3–4 weeks | **Blocked by:** E1, E2, sufficient trajectory data

- [ ] Build offline RL training pipeline using collected trajectories
- [ ] Implement reward model from execution results + user feedback + automated evaluators
- [ ] Periodically fine-tune SLM using reward signals
- [ ] Deploy updated model weights to Ollama
- [ ] A/B test against baseline

**Verification:** Fine-tuned model shows measurable improvement in task success rate.

---

## Updated Effort Estimate

| Phase | Description | Est. Effort | Status |
|---|---|---|---|
| **A** | Quick wins: knowledge docs + Ollama deploy + navigate | ~2–3 days | ✅ **Complete** |
| **B** | RAG pipeline over knowledge docs | ~2–4 days | ✅ **Complete** |
| **C** | DSPy Python service + bridge | ~3–5 days | 🟡 Not started |
| **D** | Expanded tool coverage + dynamic registry | ~3–5 days | 🟡 **D1 done, D2 pending** |
| **E** | Optimization + RL pipeline | ~2–5 weeks | 🟠 Future |
| **Total remaining** | | **~2–4 weeks** | |

> **Note:** Original estimate was 8–12 weeks. Reduced to 3–6 weeks because the AI gateway, reasoning engine, embeddings service, feedback loop, strategy learning, and agent orchestrator are already built. The heaviest remaining work is the DSPy Python service (Phase C) and RLHF pipeline (Phase E3).

---

## Priority Order (Recommended)

1. **A1** — Generate 3 missing knowledge docs (prerequisite for everything)
2. **A2** — Deploy Ollama in Docker (unlocks SLM + embeddings)
3. **B1** — Embed knowledge docs into vector store
4. **B2** — Add RAG retrieval to reasoning engine
5. **A3** — Add navigate capability (quick UX win)
6. **D1** — Add write/mutate tools
7. **C1** — Create DSPy Python service
8. **C2** — Bridge reasoning engine to DSPy
9. **D2** — Dynamic tool discovery
10. **E1** — DSPy prompt optimization
11. **E2** — Agent trajectory logging
12. **E3** — RLHF pipeline (long-term)

---

## Files Reference

Key files involved in current SLM+AI architecture:

| File | Role |
|---|---|
| [`reasoning-engine.mjs`](file:///home/subbu/Downloads/Projects/0MultiAppHosting/control-plane-api/src/reasoning-engine.mjs) | Intent planning, tool selection, structured output, Ollama SLM rewrite |
| [`ai-gateway.mjs`](file:///home/subbu/Downloads/Projects/0MultiAppHosting/control-plane-api/src/ai-gateway.mjs) | API gateway: analyze/research/recommend/command + guardrails |
| [`tool-service.mjs`](file:///home/subbu/Downloads/Projects/0MultiAppHosting/control-plane-api/src/tool-service.mjs) | Structured tool registry with schema validation + audit |
| [`embeddings-service.mjs`](file:///home/subbu/Downloads/Projects/0MultiAppHosting/control-plane-api/src/embeddings-service.mjs) | Chunking, embedding (Ollama + fallback), persistence |
| [`feedback-loop.mjs`](file:///home/subbu/Downloads/Projects/0MultiAppHosting/control-plane-api/src/feedback-loop.mjs) | Outcome recording, performance metrics |
| [`strategy-learning.mjs`](file:///home/subbu/Downloads/Projects/0MultiAppHosting/control-plane-api/src/strategy-learning.mjs) | Prediction accuracy, strategy adjustments |
| [`agent-orchestrator.mjs`](file:///home/subbu/Downloads/Projects/0MultiAppHosting/control-plane-api/src/agent-orchestrator.mjs) | Multi-agent workflow lifecycle |
| [`memory-service.mjs`](file:///home/subbu/Downloads/Projects/0MultiAppHosting/control-plane-api/src/memory-service.mjs) | Session memory, preferences, agent experiences |
| [`assistant.server.ts`](file:///home/subbu/Downloads/Projects/0MultiAppHosting/src/lib/assistant.server.ts) | Dashboard-side assistant (regex intent, tool calls) |
| [`ai-gateway.ts`](file:///home/subbu/Downloads/Projects/0MultiAppHosting/src/services/ai-gateway.ts) | Dashboard → control-plane AI Gateway bridge |
| [`AssistantSidebar.tsx`](file:///home/subbu/Downloads/Projects/0MultiAppHosting/src/components/layout/AssistantSidebar.tsx) | Chat UI component |
| [`docker-compose.vps.yml`](file:///home/subbu/Downloads/Projects/0MultiAppHosting/docker-compose.vps.yml) | Production Docker topology with Ollama SLM deployment |
| [`SYSTEM_SPEC.md`](file:///home/subbu/Downloads/Projects/0MultiAppHosting/SYSTEM_SPEC.md) | ✅ Knowledge doc — system specification |
| [`UI_BLUEPRINT.md`](file:///home/subbu/Downloads/Projects/0MultiAppHosting/UI_BLUEPRINT.md) | ✅ Knowledge doc — UI blueprint |
| [`UI_WIREFRAME_SPEC.md`](file:///home/subbu/Downloads/Projects/0MultiAppHosting/UI_WIREFRAME_SPEC.md) | ✅ Knowledge doc — wireframe specifications |
| [`API_ROUTE_MAP.md`](file:///home/subbu/Downloads/Projects/0MultiAppHosting/API_ROUTE_MAP.md) | ✅ Knowledge doc — 55 API endpoints |
| [`FRONTEND_ARCHITECTURE.md`](file:///home/subbu/Downloads/Projects/0MultiAppHosting/FRONTEND_ARCHITECTURE.md) | ✅ Knowledge doc — frontend structure |
| [`AI_PROJECT_CONTEXT.md`](file:///home/subbu/Downloads/Projects/0MultiAppHosting/AI_PROJECT_CONTEXT.md) | ✅ Knowledge doc — AI project context |
