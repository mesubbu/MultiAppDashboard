# Deployment Runbook

## Target architecture

- Dashboard -> Cloudflare Workers via OpenNext
- Control Plane API + Postgres + Redis + NGINX + cloudflared -> VPS via Docker Compose

## Phase 0: Record final values

1. Production dashboard hostname
2. Production control-plane hostname
3. Staging dashboard hostname
4. Staging control-plane hostname
5. VPS public IP or hostname
6. Cloudflare account ID
7. Cloudflare API token
8. VPS SSH user and port
9. Final repo clone URL

## Phase 1: Validate the repo locally

1. `corepack enable`
2. `pnpm install --frozen-lockfile`
3. `pnpm lint`
4. `pnpm typecheck`
5. `pnpm test`
6. `pnpm build`

## Phase 2: Prepare Cloudflare resources

1. Create staging and production Worker environments
2. Create D1 databases
3. Create KV namespaces
4. Create R2 buckets
5. Create Queue producers if used
6. Update `wrangler.toml` placeholder IDs

Do not deploy until all `REPLACE_WITH_*` values are resolved.

## Phase 3: Set Cloudflare secrets

Set for staging and production:

- `SESSION_SECRET`
- `CONTROL_PLANE_API_TOKEN`
- `DATABASE_URL`
- `ADMIN_MFA_TEST_CODE`

Manual bootstrap sequence:

1. `pnpm cf:typegen`
2. `wrangler secret put SESSION_SECRET --env staging`
3. `wrangler secret put CONTROL_PLANE_API_TOKEN --env staging`
4. `wrangler secret put DATABASE_URL --env staging`
5. `wrangler secret put ADMIN_MFA_TEST_CODE --env staging`

Repeat for `production`.

## Phase 4: Provision the VPS

1. Install Docker Engine
2. Install Docker Compose plugin
3. Install Git
4. Configure SSH access
5. Restrict network exposure

Public ports:

- `80`
- `443`
- SSH

Keep private/internal:

- `3000`
- `4100`
- `5432`
- `6379`
- `2000`

## Phase 5: Create the VPS directory structure

Create:

- `/srv/apps/dashboard/state`
- `/srv/apps/control-plane-api/state`
- `/srv/apps/nginx/conf.d`
- `/srv/apps/nginx/certs`
- `/srv/apps/cloudflared`
- `/srv/knowledge-layer/postgres`
- `/srv/knowledge-layer/redis`
- `/srv/knowledge-layer/object-storage`
- `/srv/logs/dashboard`
- `/srv/logs/control-plane-api`
- `/srv/logs/nginx`
- `/srv/logs/cloudflared`
- `/srv/logs/postgres`
- `/srv/logs/redis`
- `/srv/secrets`

## Phase 6: Clone the repo onto the VPS

1. Choose the final deploy path
2. Clone the full repository there
3. Ensure the path contains `docker-compose.vps.yml`
4. Match the path used by GitHub Actions `VPS_DEPLOY_PATH`

Important: the workflow default path must contain the full repo, not only the `control-plane-api/` subfolder.

## Phase 7: Create secret files on the VPS

Create:

1. `/srv/secrets/dashboard_session_secret`
2. `/srv/secrets/control_plane_api_token`
3. `/srv/secrets/platform_database_url`
4. `/srv/secrets/postgres_password`
5. `/srv/secrets/cloudflare_tunnel_token`

## Phase 8: Create environment files

Use:

- `.env.production.example`
- `.env.staging.example`

Populate:

1. `/srv/apps/dashboard/.env.production`
2. `/srv/apps/control-plane-api/.env.production`

Set at least:

- `NODE_ENV=production`
- `CONTROL_PLANE_API_BASE_URL`
- `NEXT_PUBLIC_CONTROL_PLANE_API_BASE_URL`
- `CONTROL_PLANE_ALLOWED_ORIGIN`
- `CONTROL_PLANE_API_HOST=0.0.0.0`
- `CONTROL_PLANE_API_PORT=4100`
- `REDIS_URL=redis://redis:6379/0`

## Phase 9: Copy NGINX and tunnel config

Copy:

1. `ops/nginx/nginx.conf` -> `/srv/apps/nginx/nginx.conf`
2. `ops/nginx/conf.d/dashboard.conf` -> `/srv/apps/nginx/conf.d/dashboard.conf`
3. `ops/cloudflared/config.yml.example` -> `/srv/apps/cloudflared/config.yml`

Also provide:

1. `/srv/apps/nginx/certs/tls.crt`
2. `/srv/apps/nginx/certs/tls.key`

## Phase 10: Create the Cloudflare Tunnel

1. Create a tunnel in Cloudflare Zero Trust
2. Generate the connector token
3. Save the token to `/srv/secrets/cloudflare_tunnel_token`
4. Configure ingress for the chosen dashboard and control-plane hostnames

## Phase 11: Start the data layer first

From repo root on the VPS:

1. `docker compose -f docker-compose.vps.yml up -d postgres redis`
2. `docker compose -f docker-compose.vps.yml ps`
3. `docker compose -f docker-compose.vps.yml logs postgres`
4. `docker compose -f docker-compose.vps.yml logs redis`

Proceed only when both services are healthy.

## Phase 12: Run database migrations

1. `DATABASE_URL="$(cat /srv/secrets/platform_database_url)" pnpm db:migrate`
2. Optional: `DATABASE_URL="$(cat /srv/secrets/platform_database_url)" pnpm db:seed`

## Phase 13: Deploy VPS application services

1. `docker compose -f docker-compose.vps.yml up -d --build control-plane-api nginx cloudflared`
2. `docker compose -f docker-compose.vps.yml ps`
3. `docker compose -f docker-compose.vps.yml logs control-plane-api`
4. `docker compose -f docker-compose.vps.yml logs nginx`
5. `docker compose -f docker-compose.vps.yml logs cloudflared`

Expected health endpoints:

- control-plane API: `/health`
- NGINX: `/healthz`

## Phase 14: Deploy the dashboard to staging

1. Confirm staging settings in `wrangler.toml`
2. Confirm staging secrets exist
3. Run `pnpm cf:typegen` if needed
4. Run `pnpm deploy:staging`

## Phase 15: Run staging smoke tests

1. Open the staging dashboard login page
2. Log in with an MFA-enabled admin account
3. Switch tenant scope
4. Switch app scope
5. Open overview, tenants, apps, agents, events, and observability
6. Perform one safe mutation
7. Confirm auth, routing, and event behavior

## Phase 16: Configure GitHub Actions secrets

Cloudflare secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `SESSION_SECRET`
- `CONTROL_PLANE_API_TOKEN`
- `DATABASE_URL`

VPS secrets:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_PRIVATE_KEY`
- `VPS_SSH_KNOWN_HOSTS`

Optional vars:

- `VPS_SSH_PORT`
- `VPS_DEPLOY_PATH`

## Phase 17: Deploy production

Option A: via GitHub Actions

1. Merge to `main`
2. Let `verify`, `deploy-cloudflare-production`, and `deploy-vps-control-plane` run

Option B: manual

1. `pnpm deploy:production`
2. `git pull --ff-only` on the VPS
3. `docker compose -f docker-compose.vps.yml up -d --build control-plane-api nginx redis postgres cloudflared`

## Phase 18: Run production verification

Verify:

1. Dashboard loads over HTTPS
2. Login works
3. Protected routes require auth
4. Dashboard reaches control-plane API
5. Tenant/app switching works
6. Events page works
7. One safe mutation succeeds
8. Logs are clean
9. Containers stay healthy

Health endpoints:

- dashboard: `/api/health`
- control-plane: `/health`
- NGINX: `/healthz`

## Phase 19: Rollback plan

1. Keep the last known-good commit SHA
2. Revert or redeploy the prior dashboard version if needed
3. Check out the prior good commit on the VPS
4. Re-run `docker compose -f docker-compose.vps.yml up -d --build`
5. Restore database backups only if required