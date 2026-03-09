# Deployment Checklist

## Pre-deployment

- [ ] Finalize production and staging hostnames
- [ ] Choose dashboard-to-control-plane routing strategy
- [ ] Replace all `REPLACE_WITH_*` placeholders in `wrangler.toml`
- [ ] Provision Cloudflare Worker environments
- [ ] Provision D1, KV, R2, and Queue resources as needed
- [ ] Create Cloudflare secrets for staging and production
- [ ] Provision VPS with Docker, Compose, Git, and SSH
- [ ] Restrict public exposure to `80`, `443`, and SSH only

## VPS preparation

- [ ] Create `/srv/apps`, `/srv/logs`, `/srv/knowledge-layer`, and `/srv/secrets`
- [ ] Clone the full repo to the VPS deploy path
- [ ] Create VPS secret files under `/srv/secrets`
- [ ] Create `/srv/apps/dashboard/.env.production`
- [ ] Create `/srv/apps/control-plane-api/.env.production`
- [ ] Copy NGINX config into `/srv/apps/nginx`
- [ ] Copy cloudflared config into `/srv/apps/cloudflared/config.yml`
- [ ] Add TLS cert and key to `/srv/apps/nginx/certs`

## Validation before first deploy

- [ ] Run `corepack enable`
- [ ] Run `pnpm install --frozen-lockfile`
- [ ] Run `pnpm lint`
- [ ] Run `pnpm typecheck`
- [ ] Run `pnpm test`
- [ ] Run `pnpm build`

## Data layer bring-up

- [ ] Start Postgres
- [ ] Start Redis
- [ ] Confirm both services are healthy
- [ ] Run `pnpm db:migrate`
- [ ] Optionally run `pnpm db:seed`

## VPS app deployment

- [ ] Deploy `control-plane-api`
- [ ] Deploy `nginx`
- [ ] Deploy `cloudflared`
- [ ] Check container status with `docker compose ... ps`
- [ ] Check control-plane logs
- [ ] Check NGINX logs
- [ ] Check cloudflared logs
- [ ] Verify `/health` and `/healthz`

## Staging deployment

- [ ] Confirm staging values in `wrangler.toml`
- [ ] Confirm staging secrets exist
- [ ] Run `pnpm cf:typegen` if needed
- [ ] Run `pnpm deploy:staging`
- [ ] Verify login works in staging
- [ ] Verify tenant/app switching works
- [ ] Verify overview, tenants, apps, agents, events, and observability pages
- [ ] Perform one safe admin mutation

## GitHub Actions setup

- [ ] Add Cloudflare GitHub secrets
- [ ] Add VPS GitHub secrets
- [ ] Set `VPS_SSH_PORT` if non-default
- [ ] Set `VPS_DEPLOY_PATH` to the repo root on the VPS
- [ ] Confirm PRs deploy staging as expected
- [ ] Confirm pushes to `main` deploy production as expected

## Production deployment

- [ ] Merge approved changes to `main`
- [ ] Confirm GitHub Actions `verify` passes
- [ ] Confirm dashboard production deploy completes
- [ ] Confirm VPS deploy completes
- [ ] Verify dashboard over HTTPS
- [ ] Verify protected routes require auth
- [ ] Verify dashboard can reach the control-plane API
- [ ] Verify events and one safe mutation work
- [ ] Review logs for runtime errors

## Post-deployment

- [ ] Record deployed commit SHA
- [ ] Confirm rollback procedure is documented
- [ ] Confirm database backups are in place
- [ ] Confirm secret rotation process is documented
- [ ] Confirm monitoring/alerts are enabled