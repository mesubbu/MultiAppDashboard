# Frontend Architecture

> **Generated:** 2026-03-10
> **Framework:** Next.js 16 (App Router) + React 19 + TypeScript 5 + Tailwind CSS 4

This document describes the complete frontend architecture of the AI Platform Control Dashboard.

---

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.x |
| UI Library | React | 19.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| State | React Server Components + client hooks | — |
| Graph Visualization | @xyflow/react | 12.x |
| Icons | lucide-react | — |
| Validation | Zod | 4.x |
| Database ORM | Drizzle ORM | 0.45.x |
| Testing | Vitest + Testing Library | 4.x |
| Package Manager | pnpm | 10.x |
| Deployment | Cloudflare Pages (OpenNext) / Docker VPS | — |

---

## Directory Structure

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (HTML shell)
│   ├── globals.css               # Global styles
│   ├── error.tsx                 # Root error boundary
│   ├── loading.tsx               # Root loading skeleton
│   ├── login/                    # Login page (public)
│   ├── api/                      # Next.js API routes
│   │   ├── admin/                # Proxied control-plane admin routes
│   │   │   ├── agents/           ├── analytics/     ├── apps/
│   │   │   ├── assistant/        ├── audit/         ├── events/
│   │   │   ├── knowledge-graph/  ├── memory/        ├── models/
│   │   │   ├── observability/    ├── overview/      ├── system/
│   │   │   ├── tenants/          ├── tools/         ├── users/
│   │   ├── auth/                 # Login/logout/session
│   │   ├── health/               # Dashboard health
│   │   └── observability/        # Dashboard observability
│   └── (dashboard)/              # Dashboard route group (protected)
│       ├── layout.tsx            # DashboardLayout wrapper
│       ├── page.tsx              # Home/Overview page
│       ├── access-denied/        ├── agents/        ├── alerts/
│       ├── analytics/            ├── apps/          ├── audit/
│       ├── events/               ├── incidents/     ├── knowledge-graph/
│       ├── memory/               ├── models/        ├── observability/
│       ├── recommendations/      ├── research/      ├── settings/
│       ├── signals/              ├── tenants/       ├── tools/
│       ├── users/                └── workflows/
├── components/
│   ├── layout/                   # Shell components
│   │   ├── DashboardLayout.tsx   # Sidebar + topbar + content area
│   │   ├── AssistantSidebar.tsx  # AI chat sidebar
│   │   └── ...
│   ├── dashboard/                # Domain-specific components (39 files)
│   │   ├── AgentDashboard.tsx         ├── AgentMonitor.tsx
│   │   ├── AgentOrchestrationBoard.tsx├── AppManager.tsx
│   │   ├── AuditLogTable.tsx          ├── ClientErrorsTable.tsx
│   │   ├── EventStream.tsx            ├── GraphExplorer.tsx
│   │   ├── LiveObservabilityCharts.tsx ├── MemoryRegistryTable.tsx
│   │   ├── MetricsCards.tsx           ├── ModelMonitor.tsx
│   │   ├── ObservabilityTable.tsx      ├── OverviewHealthTable.tsx
│   │   ├── TenantManager.tsx          ├── ToolRegistryTable.tsx
│   │   ├── UserManager.tsx            └── PageHeader.tsx
│   ├── observability/            # Observability-specific components
│   └── ui/                       # Reusable primitives (11 files)
│       ├── ClientDataTable.tsx   ├── ConfirmationModal.tsx
│       ├── DataTable.tsx         ├── DirtyStateBanner.tsx
│       ├── EmptyState.tsx        ├── ErrorState.tsx
│       ├── FilterBar.tsx         ├── SectionCard.tsx
│       ├── Skeleton.tsx          ├── StatusBadge.tsx
│       └── toast.tsx
├── hooks/
│   └── useLiveEventStream.ts     # SSE event stream hook
├── lib/                          # Core utilities (48 files)
│   ├── assistant.server.ts       # Server-side assistant (intent → tools → response)
│   ├── assistant.ts              # Shared assistant utilities (gateway routing, preferences)
│   ├── auth.ts                   # Authentication logic
│   ├── auth-shared.ts            # Session cookie validation
│   ├── auth-state.server.ts      # Server-side auth state
│   ├── rbac.ts                   # Role-based access control
│   ├── scope.ts                  # Tenant/app scope management
│   ├── circuit-breaker.ts        # Circuit breaker for external calls
│   ├── domain-events.ts          # Domain event handling
│   ├── knowledge-graph.ts        # Knowledge graph layout utilities
│   ├── graph-layouts.ts          # Graph visualization layouts
│   ├── catalog-list-query.ts     # Paginated query parsing
│   ├── control-plane-state.server.ts  # Control-plane data fetching
│   ├── control-plane-fallbacks.ts     # Fallback data when API unavailable
│   ├── env.ts                    # Environment configuration
│   ├── observability*.ts         # Observability utilities
│   └── db/                       # Drizzle ORM schema + queries
├── modules/
│   └── dashboard/                # Dashboard-specific modules
├── services/
│   ├── control-plane.ts          # Control-plane API client (17.5 KB)
│   ├── ai-gateway.ts             # AI Gateway client with circuit breaker
│   └── memory.ts                 # Memory service client
├── types/
│   ├── platform.ts               # Platform TypeScript types (18 KB)
│   └── contracts.ts              # Zod schemas for all API contracts (44 KB)
├── mocks/                        # Mock data for testing
└── test/                         # Test utilities
```

---

## Authentication & Authorization

### Flow
1. **Middleware** (`middleware.ts`) intercepts all non-API, non-static requests
2. Validates session cookie via `validateSessionCookie()`
3. Unauthenticated users → redirect to `/login`
4. Authenticated users on `/login` → redirect to `/`
5. Session tokens auto-refresh on each request

### RBAC
- Roles: `platform_owner`, `platform_admin`, `operator`, `viewer`
- Permission checks via `hasPermission(roles, permission)` in `rbac.ts`
- Each dashboard page checks permissions before rendering
- API routes enforce permissions server-side

---

## Data Flow

```
User → Dashboard Page (RSC) → lib/control-plane-state.server.ts → Service Client
                                                                       ↓
                                                          control-plane.ts (HTTP)
                                                                       ↓
                                                          Control-Plane API (port 4100)
```

### Assistant Data Flow
```
User → AssistantSidebar.tsx → /api/admin/assistant → assistant.server.ts
                                                         ↓ (when configured)
                                                    ai-gateway.ts → /ai/* endpoints
                                                         ↓
                                                    AI Gateway (reasoning engine + tools)
```

---

## Key Patterns

1. **Server Components by default** — Pages are React Server Components; client interactivity via `"use client"` components
2. **Catalog pattern** — Entity pages (tenants, apps, users, agents, tools, memory, events, audit) share a common paginated list/detail pattern with `ClientDataTable`, `FilterBar`, and catalog query parsing
3. **Circuit breaker** — External API calls use `runWithCircuitBreaker()` to prevent cascade failures
4. **Scope filtering** — All data queries scoped by `tenantId` + `appId` derived from session
5. **Contract validation** — All API requests/responses validated through Zod schemas in `contracts.ts`
6. **SSE for real-time** — Live events use `useLiveEventStream` hook connected to `/admin/events/stream`
7. **Toast notifications** — User feedback through centralized toast system in `ui/toast.tsx`

---

## Dashboard Pages (20 sections)

| Route | Component | Description |
|---|---|---|
| `/` | Overview | Platform health, metrics, alerts |
| `/agents` | AgentDashboard | Agent list, status, queue depth |
| `/analytics` | Analytics | KPIs, tenant growth, tool usage |
| `/apps` | AppManager | App CRUD management |
| `/audit` | AuditLogTable | Audit trail viewer |
| `/events` | EventStream | Real-time event feed |
| `/knowledge-graph` | GraphExplorer | Visual knowledge graph |
| `/memory` | MemoryRegistryTable | Memory scope management |
| `/models` | ModelMonitor | Model routing & switching |
| `/observability` | ObservabilityTable | Service health & charts |
| `/recommendations` | Recommendations | AI-generated recommendations |
| `/research` | Research | Research runs & schedules |
| `/settings` | Settings | Platform settings |
| `/signals` | Signals | Market signal viewer |
| `/tenants` | TenantManager | Tenant CRUD management |
| `/tools` | ToolRegistryTable | Tool registry & execution viewer |
| `/users` | UserManager | User CRUD management |
| `/workflows` | AgentOrchestrationBoard | Multi-agent workflow management |
| `/alerts` | Alerts | Alert management |
| `/incidents` | Incidents | Incident tracking |

---

## Build & Deployment

| Command | Purpose |
|---|---|
| `pnpm dev` | Local development (Next.js dev server) |
| `pnpm build` | Production build |
| `pnpm start` | Production start (Node.js) |
| `pnpm deploy` | Deploy to Cloudflare Pages |
| `pnpm control-plane:dev` | Start control-plane API |
| `pnpm test` | Run Vitest test suite |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm db:migrate` | Run Drizzle migrations |
| `pnpm db:seed` | Seed database |
