# Deployment Plan

## Recommended deployment model

- Dashboard: Cloudflare Workers via OpenNext
- Control Plane API + Postgres + Redis + NGINX + cloudflared: VPS via Docker Compose
- CI/CD: GitHub Actions from `.github/workflows/ci.yml`

## Step-by-step plan

1. Decide final deployment topology
   - Choose production and staging hostnames for the dashboard and control-plane API.
   - Decide whether the dashboard will call the control-plane on a separate hostname or via `/api/control-plane` behind NGINX.

2. Finalize Cloudflare configuration
   - Update `wrangler.toml`.
   - Replace all `REPLACE_WITH_*` placeholders for D1, KV, R2, and Queues.
   - Confirm `CONTROL_PLANE_API_BASE_URL` and `NEXT_PUBLIC_CONTROL_PLANE_API_BASE_URL` values.

3. Provision Cloudflare resources
   - Create staging and production Worker environments.
   - Create D1 databases, KV namespaces, R2 buckets, and Queues as needed.
   - Configure optional Cloudflare Access / Zero Trust rules.

4. Prepare Cloudflare secrets
   - Required secrets:
     - `SESSION_SECRET`
     - `CONTROL_PLANE_API_TOKEN`
     - `DATABASE_URL`
     - `ADMIN_MFA_TEST_CODE`

5. Provision the VPS
   - Install Docker Engine, Docker Compose plugin, Git, and SSH access.
   - Restrict public exposure to `80`, `443`, and SSH.
   - Keep internal ports private: `3000`, `4100`, `5432`, `6379`, `2000`.

6. Create VPS filesystem layout
   - Create the `/srv` layout expected by `docs/deployment.md` and `docker-compose.vps.yml`.
   - Include app folders, logs, knowledge-layer storage, and secret files.

7. Clone the repository onto the VPS
   - Clone the full repository into the deploy path used by GitHub Actions.
   - Ensure the chosen deploy path contains the repo root and `docker-compose.vps.yml`.

8. Create VPS secrets
   - Create:
     - `/srv/secrets/dashboard_session_secret`
     - `/srv/secrets/control_plane_api_token`
     - `/srv/secrets/platform_database_url`
     - `/srv/secrets/postgres_password`
     - `/srv/secrets/cloudflare_tunnel_token`

9. Create environment files
   - Use `.env.production.example` and `.env.staging.example` as templates.
   - Populate `/srv/apps/dashboard/.env.production` and `/srv/apps/control-plane-api/.env.production`.
   - Keep secrets in `/srv/secrets/*` instead of env files where possible.

10. Copy NGINX and cloudflared config
   - Copy `ops/nginx/nginx.conf` and `ops/nginx/conf.d/dashboard.conf` into `/srv/apps/nginx`.
   - Copy `ops/cloudflared/config.yml.example` to `/srv/apps/cloudflared/config.yml` and customize it.
   - Provide TLS files at `/srv/apps/nginx/certs/tls.crt` and `/srv/apps/nginx/certs/tls.key`.

11. Run local verification before deployment
   - Run:
     - `pnpm install --frozen-lockfile`
     - `pnpm lint`
     - `pnpm typecheck`
     - `pnpm test`
     - `pnpm build`

12. Start the data layer
   - Bring up Postgres and Redis first.
   - Verify they are healthy before continuing.

13. Run database migrations
   - Run `pnpm db:migrate` with the production `DATABASE_URL`.
   - Optionally run `pnpm db:seed` for sample/demo data.

14. Deploy VPS application services
   - Deploy `control-plane-api`, `nginx`, and `cloudflared`.
   - Verify health endpoints and container logs.

15. Deploy the dashboard to staging
   - Use `pnpm cf:typegen` if needed.
   - Deploy with `pnpm deploy:staging`.
   - Or allow the existing GitHub workflow to deploy staging from PRs.

16. Run staging smoke tests
   - Log in with MFA.
   - Switch tenant/app scope.
   - Verify overview, tenants, apps, agents, events, and observability pages.
   - Perform one safe mutation such as model switch or agent pause/restart.

17. Configure GitHub Actions secrets
   - Cloudflare:
     - `CLOUDFLARE_ACCOUNT_ID`
     - `CLOUDFLARE_API_TOKEN`
     - `SESSION_SECRET`
     - `CONTROL_PLANE_API_TOKEN`
     - `DATABASE_URL`
   - VPS:
     - `VPS_HOST`
     - `VPS_USER`
     - `VPS_SSH_PRIVATE_KEY`
     - `VPS_SSH_KNOWN_HOSTS`
   - Optional vars:
     - `VPS_SSH_PORT`
     - `VPS_DEPLOY_PATH`

18. Deploy production
   - Merge to `main`.
   - Let GitHub Actions run `verify`, `deploy-cloudflare-production`, and `deploy-vps-control-plane`.
   - Or deploy manually if needed.

19. Run production verification
   - Verify dashboard login, protected routes, control-plane connectivity, events, and one safe admin mutation.
   - Check health endpoints:
     - dashboard: `/api/health`
     - control-plane: `/health`
     - NGINX: `/healthz`

20. Define rollback and recovery
   - Keep a last-known-good commit SHA.
   - Be ready to redeploy a previous version of the dashboard and VPS stack.
   - Maintain Postgres backups and a secret rotation procedure.

## Important repo-specific notes

- `wrangler.toml` still contains placeholder values and must be finalized before first deploy.
- The workflow default `VPS_DEPLOY_PATH` points to `/srv/apps/control-plane-api`, but that path must contain the full repo root.
- The checked-in NGINX config expects TLS files to exist before HTTPS will work.
- `docker-compose.vps.yml` contains placeholder/example internal services that are not required for the first successful rollout.

## Recommended rollout order

1. Finalize domains and topology
2. Provision Cloudflare resources
3. Provision VPS
4. Create `/srv` directories and secrets
5. Clone repo to VPS
6. Fill env files and copy config
7. Run local verification
8. Start Postgres + Redis
9. Run DB migrations
10. Deploy control-plane + NGINX + tunnel
11. Deploy staging dashboard
12. Smoke test staging
13. Configure GitHub secrets
14. Deploy production
15. Verify and document rollback