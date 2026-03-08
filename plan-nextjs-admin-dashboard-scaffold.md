## 1. Overview

Implement a production-grade `Next.js` admin dashboard scaffold for a multi-tenant AI platform using the App Router, TypeScript, and a typed service layer.

**Goals**
- Deliver a clean starter that can grow into a real admin product.
- Bake in tenant awareness, auth boundaries, RBAC hooks, typed API contracts, and reusable dashboard primitives.
- Keep the first pass small enough to bootstrap in an empty repo.

**Success criteria**
- App boots with public + protected route groups.
- Shared layout, navigation, auth guard, tenant context, and API client are in place.
- Core dashboard pages render with typed mock/service-backed data.
- Folder structure clearly separates UI, domain types, and API contracts.

**Out of scope for this scaffold**
- Full auth provider setup, billing engine, real analytics pipeline, and complete CRUD flows.
- Production infrastructure, CI/CD, and backend implementation.

## 2. Prerequisites

- Initialize a new `Next.js` app with `TypeScript`, `ESLint`, and `Tailwind CSS`.
- Recommended add-ons: `zod`, `react-hook-form`, `@tanstack/react-table`, `lucide-react`, and a query/cache layer such as `@tanstack/react-query`.
- Choose auth early (`NextAuth/Auth.js`, Clerk, or custom JWT/session cookies).
- Define one environment file shape up front:
  - `NEXT_PUBLIC_APP_NAME`
  - `NEXT_PUBLIC_API_BASE_URL`
  - `NEXT_PUBLIC_AUTH_PROVIDER`
- No database migration is required for the scaffold itself.

## 3. Implementation Steps

**Step 1: Bootstrap the base app**
- Create the Next.js project and keep code under `src/`.
- Files: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.*`, `src/app/layout.tsx`, `src/app/globals.css`.
- Add a neutral design token layer in CSS for colors, spacing, border radius, and dark mode.
- Testing: app starts, root layout renders, Tailwind/styles load.

**Step 2: Define route groups and shell layouts**
- Create route groups for public auth pages and protected dashboard pages.
- Files: `src/app/(public)/login/page.tsx`, `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/page.tsx`.
- Protected layout should own sidebar, topbar, tenant switcher slot, and content container.
- Testing: public routes render without dashboard chrome; protected routes render with shell.

**Step 3: Add auth, session, and tenant guards**
- Add `middleware.ts` plus server utilities to gate protected routes.
- Files: `middleware.ts`, `src/lib/auth/session.ts`, `src/lib/auth/permissions.ts`, `src/lib/tenant/current-tenant.ts`.
- Model auth around `user`, `session`, `tenantId`, and `roles`; keep permission checks reusable.
- Testing: unauthenticated users redirect; role/tenant utilities behave deterministically.

**Step 4: Establish typed contracts and domain models**
- Create a clear split between transport contracts and UI/domain types.
- Files: `src/contracts/*.ts`, `src/types/*.ts`.
- Minimum types/contracts: `Auth`, `Tenant`, `User`, `Role`, `UsageMetric`, `ProviderConnection`, `ApiKey`, `AuditEvent`, `PaginatedResponse`, `ApiError`.
- Use `zod` schemas for runtime validation at API boundaries.
- Testing: schema parsing covers valid and invalid payloads.

**Step 5: Build the service/API layer**
- Centralize HTTP logic and feature-specific services.
- Files: `src/lib/api/client.ts`, `src/lib/api/endpoints.ts`, `src/services/tenants.ts`, `src/services/users.ts`, `src/services/usage.ts`, `src/services/providers.ts`.
- The API client should inject auth token/session context, tenant header, request IDs, and normalized error handling.
- Prefer feature services returning typed objects instead of calling `fetch` directly inside pages.
- Testing: client handles headers, error normalization, and typed response parsing.

**Step 6: Create reusable dashboard primitives**
- Build a small reusable component library before feature pages.
- Files: `src/components/layout/*`, `src/components/navigation/*`, `src/components/dashboard/*`, `src/components/feedback/*`, `src/components/forms/*`.
- Minimum components: `Sidebar`, `Topbar`, `TenantSwitcher`, `NavSection`, `StatCard`, `DataTable`, `PageHeader`, `EmptyState`, `ErrorState`, `LoadingSkeleton`, `Badge`.
- Testing: components render stable states and key accessibility attributes.

**Step 7: Scaffold the core admin pages**
- Add thin pages wired to mock data or the service layer.
- Files:
  - `src/app/(dashboard)/page.tsx` (overview)
  - `src/app/(dashboard)/tenants/page.tsx`
  - `src/app/(dashboard)/users/page.tsx`
  - `src/app/(dashboard)/usage/page.tsx`
  - `src/app/(dashboard)/providers/page.tsx`
  - `src/app/(dashboard)/audit/page.tsx`
  - `src/app/(dashboard)/settings/page.tsx`
- Each page should follow the same pattern: page header, summary cards, table/list, empty/loading/error states.
- Testing: pages render with mocked service responses and no direct data-shape assumptions.

**Step 8: Add mocks and local developer ergonomics**
- Provide seed/mock data to unblock frontend work before backend readiness.
- Files: `src/mocks/*.ts`, optionally `src/app/api/mock/*` for local route handlers.
- Keep mock fixtures aligned with `contracts/` so replacement with real APIs is low-risk.
- Testing: story-like/manual dev checks for empty, success, and failure states.

**Step 9: Add baseline test and quality tooling**
- Set up unit tests and basic component/service coverage.
- Files: `vitest.config.ts` or `jest.config.ts`, `src/test/setup.ts`, `src/**/*.test.ts(x)`.
- Add scripts for `lint`, `typecheck`, `test`, and `test:watch`.
- Testing: CI-ready commands pass locally on the scaffold.

## 4. Recommended File Structure

- `src/app/`
  - `(public)/login/page.tsx`
  - `(dashboard)/layout.tsx`
  - `(dashboard)/page.tsx`
  - `(dashboard)/tenants/page.tsx`
  - `(dashboard)/users/page.tsx`
  - `(dashboard)/usage/page.tsx`
  - `(dashboard)/providers/page.tsx`
  - `(dashboard)/audit/page.tsx`
  - `(dashboard)/settings/page.tsx`
- `src/components/`
  - `layout/`, `navigation/`, `dashboard/`, `feedback/`, `forms/`, `ui/`
- `src/lib/`
  - `auth/`, `tenant/`, `api/`, `utils/`
- `src/services/`
- `src/contracts/`
- `src/types/`
- `src/mocks/`
- `src/test/`
- Root: `middleware.ts`, `next.config.ts`, `package.json`, `tsconfig.json`, `eslint.config.*`, `.env.example`

## 5. Minimum Files for a Clean Starter

- `package.json`
- `next.config.ts`
- `tsconfig.json`
- `eslint.config.*`
- `.env.example`
- `middleware.ts`
- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/app/(public)/login/page.tsx`
- `src/app/(dashboard)/layout.tsx`
- `src/app/(dashboard)/page.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/Topbar.tsx`
- `src/components/navigation/TenantSwitcher.tsx`
- `src/components/dashboard/StatCard.tsx`
- `src/components/dashboard/DataTable.tsx`
- `src/components/feedback/{EmptyState,ErrorState,LoadingSkeleton}.tsx`
- `src/lib/auth/session.ts`
- `src/lib/auth/permissions.ts`
- `src/lib/tenant/current-tenant.ts`
- `src/lib/api/client.ts`
- `src/services/{tenants,users,usage,providers}.ts`
- `src/contracts/{common,auth,tenant,user,usage,provider,audit}.ts`
- `src/types/{auth,tenant,user,usage,provider,audit}.ts`

## 6. Testing Strategy

- **Unit tests**: permission helpers, tenant selection logic, API client error mapping, contract/schema validation.
- **Component tests**: sidebar nav, tenant switcher, stat card, table, empty/error/loading states.
- **Page tests**: overview and one list page using mocked services.
- **Manual smoke test**:
  1. Visit `/login`.
  2. Visit protected routes and confirm redirect behavior.
  3. Simulate tenant switch and confirm service calls/header context update.
  4. Verify empty/error/loading states render cleanly.

## 7. Rollback Plan

- Revert scaffold files in one changeset if the structure proves too heavy.
- Remove middleware/auth guard first if route access blocks local development.
- If contracts or services are over-modeled, collapse them into fewer files without changing route structure.
- No data rollback is needed unless a real backend/mock API is later attached.

## 8. Estimated Effort

- **Complexity**: Medium.
- **Time**:
  - Base scaffold: 0.5-1 day
  - Typed contracts + services + reusable components: 1-2 days
  - Core pages + tests: 1-2 days
- **Total for a solid starter**: ~3-5 working days.

