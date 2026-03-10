# Repository Guidelines

## Project Structure & Module Organization

`src/app` contains the Next.js App Router UI and API routes. Dashboard pages live under `src/app/(dashboard)`, auth endpoints under `src/app/api/auth`, and admin/control routes under `src/app/api/admin`. Shared UI is split across `src/components/dashboard`, `src/components/layout`, and `src/components/ui`. Core business logic, RBAC, observability, and persistence helpers live in `src/lib`, while `src/services` wraps control-plane access and `src/types` holds typed contracts.

`control-plane-api/src` is the standalone Node control-plane service implemented in `.mjs` modules. Database migrations live in `drizzle/`, helper scripts in `scripts/`, deployment assets in `ops/`, and deeper architecture/runbook material in `docs/`.

## Build, Test, and Development Commands

- `pnpm install`: install dependencies and enable Husky hooks.
- `cp .env.example .env.local`: create local config before running the app.
- `pnpm dev`: start the Next.js dashboard on `localhost:3000`.
- `pnpm control-plane:dev`: run the local control-plane API.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build`: full verification expected before a PR.
- `pnpm test:coverage`: generate Vitest coverage output in `coverage/`.
- `pnpm db:migrate` and `pnpm db:seed`: apply Drizzle migrations and seed Postgres-backed state.

## Coding Style & Naming Conventions

Use TypeScript for dashboard code and `.mjs` for the control-plane service. Follow Prettier defaults in this repo: 2-space indentation, single quotes, semicolons, and trailing commas. Use `PascalCase` for React components, `camelCase` for functions and hooks, and colocated test files named `*.test.ts`, `*.test.tsx`, or `*.test.mjs`. Prefer the `@/` alias for imports from `src`.

Keep admin route handlers permission-guarded with the existing helpers instead of duplicating RBAC logic in components.

## Testing Guidelines

Vitest runs in `jsdom` with Testing Library setup from `src/test/setup.ts`. Coverage thresholds are enforced at 43% statements, 37% branches, 43% functions, and 44% lines. Add or extend tests whenever behavior changes, especially for admin APIs, RBAC, and control-plane state transitions.

## Commit & Pull Request Guidelines

Recent history uses short, task-focused subjects such as `SLM fixes` and `DeployPlan`. Keep commit titles brief, specific, and limited to one logical change. PRs should summarize impact, note schema or environment changes, link the relevant task/issue, and include screenshots for dashboard UI changes. CI re-runs `lint`, `typecheck`, `test`, and `build`; same-repo PRs may also deploy to staging.

## Security & Configuration Tips

Never commit secrets from `.env`, `.env.local`, or deployment credentials. Use `.env.example`, `.env.staging.example`, and `.env.production.example` as templates, and keep sensitive values such as `SESSION_SECRET`, `CONTROL_PLANE_API_TOKEN`, and `DATABASE_URL` in local or CI/CD secret stores.
