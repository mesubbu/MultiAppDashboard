## Contributing

- Use `pnpm install` to bootstrap the workspace.
- Copy `.env.example` to `.env.local` for dashboard dev and set `DATABASE_URL` if you want Postgres-backed state.
- Run `pnpm db:migrate` and `pnpm db:seed` after pointing `DATABASE_URL` at a local Postgres instance.
- Start the dashboard with `pnpm dev` and the control-plane API with `pnpm control-plane:dev`.
- Before opening a PR, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- The pre-commit hook runs lint, typecheck, and Prettier checks automatically after `pnpm install`.
- Keep route handlers permission-guarded with the existing admin helpers and update/extend tests when behavior changes.
