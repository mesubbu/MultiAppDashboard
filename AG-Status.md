# AG-Status — AI Platform Control Dashboard

> **Analysis date**: 2026-03-09  
> **Codebase**: `ai-platform-control-dashboard@1.0.0`  
> **Stack**: Next.js 16 · React 19 · Tailwind 4 · Zod 4 · Drizzle ORM · Postgres · OpenNext/Cloudflare · Vitest 4

---

## 1. Current Build Health

| Check | Result |
|---|---|
| `pnpm lint` | ✅ Pass — zero warnings/errors |
| `pnpm typecheck` | ✅ Pass — zero TypeScript errors |
| `pnpm test` | ✅ 114/114 tests pass across 39 test files |
| `pnpm test:coverage` | ✅ Pass — Vitest V8 coverage reporting enabled with ratcheted thresholds (43 statements / 37 branches / 43 functions / 44 lines); current baseline: 45.87% lines / 44.81% statements / 45.07% functions / 38.24% branches |
| `pnpm build` | ✅ Pass — production build completed; 38 app routes generated |

The repository currently builds, lints, type-checks, and tests cleanly. The old scaffold-level issues recorded on 2026-03-08 are no longer representative of the codebase.

---

## 2. What Is Already Done (Strengths)

### Architecture & delivery foundation
- Well-layered Next.js App Router dashboard with typed service layer, route handlers, mock fallbacks, and standalone control-plane API.
- Cloudflare/OpenNext deployment assets are present: `wrangler.toml`, `open-next.config.ts`, deploy scripts, and environment-specific bindings.
- VPS/container deployment assets are present: `Dockerfile`, `docker-compose.yml`, and `docker-compose.vps.yml`.
- CI/CD workflow exists in `.github/workflows/ci.yml` for verify + Cloudflare/VPS deploy jobs.

### Authentication, session security, and RBAC
- Signed session cookies with server-side session storage.
- MFA enforcement for privileged demo accounts.
- Session rotation, logout invalidation, and login audit history.
- Middleware route protection plus server-side permission enforcement through `withPermission` and protected control-plane routes.
- Tenant/app scope clamping is enforced for non-platform roles.

### Persistence and data layer
- Drizzle schema and SQL migration assets exist under `src/lib/db/` and `drizzle/`.
- Dashboard auth/catalog/control-plane state supports durable local files and Postgres-backed storage.
- Control-plane API has DB-backed repositories and query scoping for tenant/app-aware resources.
- Seed and migration scripts are present (`pnpm db:migrate`, `pnpm db:seed`).

### Feature completeness already delivered
- Dashboard modules exist for overview, tenants, apps, users, agents, tools, models, memory, knowledge graph, events, analytics, observability, audit, and settings.
- Cursor-based pagination and server-side filtering exist across catalog-style list endpoints.
- Tenant switching is implemented in the dashboard shell and persisted through auth context updates.
- Error boundaries and loading states are implemented for the dashboard.
- SSE live event streaming exists via `/api/admin/events/stream` and the control-plane API stream endpoint.
- Agent actions, model switching, audit export, and settings/system routes are wired through protected APIs.
- Observability page now supports optional embedded Grafana panels, Grafana/Loki/Prometheus deep links, Prometheus-backed service metric ingestion, live queue/resource/latency charts, and configurable per-service threshold-derived health alerts via env-configured integrations plus protected API polling.

### UX, resilience, and quality
- Shared data tables support pagination, sorting, and filter propagation.
- Shared circuit breaker protection now guards repeated remote control-plane failures.
- Skip-to-content link, focus states, keyboard navigation support, ARIA work, and Lighthouse-backed accessibility audit evidence are present.
- Client error reporting and scoped observability views are implemented.
- Test suite now covers auth, RBAC, route scoping, contracts, local control-plane state, admin catalog flows, apps/tenants/users/tools dashboard page composition, control-plane service behavior, observability server helpers, recent client error storage, audit/log table interactions, observability table rendering, overview health/pagination behavior, app/tenant/user manager create-save-filter flows, metrics/page-header rendering, orchestration logic, live events, client errors, selected accessibility semantics, and the standalone control-plane server.
- Coverage reporting is now wired through `pnpm test:coverage`, producing HTML and JSON summary output under `coverage/`, with a ratcheted enforced threshold that has now been raised again as page coverage expands.
- Lighthouse accessibility audits were run successfully against `/login`, `/`, `/observability`, and `/audit`, with JSON reports stored under `artifacts/lighthouse/`.

---

## 3. Current Gaps / Remaining Work

### 🔴 Critical / deploy-adjacent

| # | Gap | Impact |
|---|---|---|
| 1 | **Manual external hardening is still required** — Cloudflare Access / Zero Trust, Cloudflare Tunnel, production secret provisioning, GitHub branch protection, and real staging smoke verification are not enforceable from this repo alone. | Repo is close to deployable, but production readiness still depends on out-of-repo infrastructure work. |
| 2 | **Cloudflare WAF / edge rate limiting remains a manual ops task** | Server-side rate limiting exists, but edge protection is still incomplete. |

### 🟡 Important

| # | Gap | Impact |
|---|---|---|
| 3 | **Coverage floor is now meaningfully ratcheted but still below the long-term target, and browser E2E is not set up** | The enforced floor is stronger than before, but it still needs more page/route and browser coverage to approach the long-term target. |
| 4 | **Full WCAG 2.1 AA evidence is still incomplete outside the audited key routes** | Lighthouse coverage is now in place for major routes, but broader route coverage and manual assistive-tech validation are still worthwhile. |
| 5 | **Internationalization is not started** | UI remains English-only and not RTL-ready. |
| 6 | **Notification system and multi-region work are still backlog items** | Ops maturity is incomplete for larger-scale deployments. |

### 🟢 Minor / DX backlog

| # | Gap | Impact |
|---|---|---|
| 7 | **Storybook catalog is missing** | Reusable UI components do not yet have isolated visual documentation. |
| 8 | **Training assets remain only loosely integrated** | `training/` still looks more like reference material than an active product feature. |

---

## 4. Recommended Next Work

### Highest-value repo-local tasks
1. Continue expanding dashboard page/route coverage into the larger Suspense-heavy pages and protected API routes so the ratcheted **minimum coverage threshold** can keep moving upward toward the long-term target, then add targeted E2E coverage.
2. Expand targeted UI verification around the observability dashboard and admin flows now that core accessibility audits are in place.
3. Broaden accessibility verification beyond the key audited routes and continue toward stronger WCAG 2.1 AA evidence.

### Manual infrastructure tasks outside the repo
1. Configure **Cloudflare Access / Zero Trust** for dashboard and admin endpoints.
2. Create the **Cloudflare Tunnel** between edge and VPS control-plane services.
3. Enforce **GitHub branch protection** requiring CI before merge.
4. Execute a full **staging smoke test** against real infrastructure.

---

## 5. File Inventory Summary

- `src/` — 165 files / 61 directories
- `control-plane-api/` — 23 files / 2 directories
- `docs/` — 4 files
- `training/` — 11 files / 1 directory
- `.github/workflows/` — 1 workflow file (`ci.yml`)

Key repo assets now include:
- app routes for dashboard UI + protected admin APIs
- Postgres/Drizzle persistence code and SQL migrations
- Cloudflare deploy config (`wrangler.toml`, `open-next.config.ts`)
- Docker/VPS deployment files
- CI/CD automation

---

## 6. Verdict

**Status: strong deployable foundation, but not fully production-hardened yet.**

This is no longer just a scaffold. The project now has real auth/session handling, RBAC enforcement, durable storage options, paginated/scoped APIs, SSE streaming, circuit-breaker protection for remote control-plane calls, env-configurable Grafana embeds and service deep links, Prometheus-backed observability ingestion, live observability charts, configurable per-service threshold alerts, deployment configuration, CI/CD automation, documented Lighthouse accessibility audits for key routes, working Vitest coverage reporting, and a ratcheted enforced coverage floor. The main remaining work is concentrated in operational hardening and polish: external Cloudflare/GitHub setup, stronger coverage/E2E guarantees, and broader WCAG evidence.

**Estimated effort to reach a production-hardened MVP:** roughly **1–2 weeks of repo work**, plus the required **manual infrastructure configuration and staging verification** outside the repository.

