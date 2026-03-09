# Deployment guide

## Cloudflare dashboard deployment

- The dashboard deploys with **OpenNext for Cloudflare**.
- Use `wrangler.toml` for non-secret config and bindings.
- Use GitHub **environment secrets** or `wrangler secret put` for sensitive values.

### Required Cloudflare secrets

- `SESSION_SECRET`
- `CONTROL_PLANE_API_TOKEN`
- `DATABASE_URL`
- `ADMIN_MFA_TEST_CODE`

### Secret bootstrap commands

```bash
pnpm cf:typegen
wrangler secret put SESSION_SECRET --env staging
wrangler secret put CONTROL_PLANE_API_TOKEN --env staging
wrangler secret put DATABASE_URL --env staging
pnpm deploy:staging
```

Repeat the same secret bootstrap for `production`.

### Cloudflare Tunnel (repo-side setup ready)

- `docker-compose.vps.yml` now includes a `cloudflared` sidecar for the VPS stack.
- Store the remote-managed tunnel token at `/srv/secrets/cloudflare_tunnel_token`.
- Copy `ops/cloudflared/config.yml.example` to `/srv/apps/cloudflared/config.yml` if you want a checked-in reference for hostnames/ingress.
- Keep the dashboard and control-plane services private; tunnel traffic terminates inside the compose network.

### Manual Cloudflare tasks still required

1. **Create the tunnel in Cloudflare Zero Trust**
   - Generate a tunnel token for the VPS connector
   - Save it to `/srv/secrets/cloudflare_tunnel_token`
   - Start or restart `cloudflared` with `docker compose -f docker-compose.vps.yml up -d cloudflared`
2. **DNS / public hostname routing**
   - Route `dashboard.example.com` to `http://nginx:80`
   - Route `control-plane.example.com` to `http://control-plane-api:4100`
   - Restrict direct VPS ingress so public access flows through Cloudflare
3. **Staging smoke test**
   - Login with an MFA account
   - Switch tenant/app scope
   - Load overview, tenants, apps, agents, events, and observability pages
   - Execute one safe admin mutation (model switch or agent pause/restart)
   - Confirm audit/event output and rollback behaviour

## Edge ↔ VPS migration path

| Capability                  | Near-term home               | Longer-term target                 |
| --------------------------- | ---------------------------- | ---------------------------------- |
| Next.js dashboard shell     | Cloudflare Worker            | Cloudflare Worker                  |
| Auth/session cookies        | Worker + secret              | Worker + KV-backed session cache   |
| Tenant/admin catalog reads  | Control Plane API + Postgres | D1 for edge-local admin metadata   |
| Audit exports / large blobs | VPS filesystem               | R2                                 |
| Event fan-out               | VPS services                 | Cloudflare Queues producer at edge |
| AI orchestration services   | VPS private network          | VPS private network                |
| Control-plane API           | VPS private network + tunnel | VPS private network + tunnel       |

## VPS layout

### `/srv` directory structure

```text
/srv
├── apps/
│   ├── dashboard/
│   │   ├── .env.production
│   │   └── state/
│   ├── control-plane-api/
│   │   ├── .env.production
│   │   └── state/
│   ├── nginx/
│       ├── nginx.conf
│       ├── conf.d/
│       └── certs/
│   └── cloudflared/
│       └── config.yml
├── knowledge-layer/
│   ├── postgres/
│   ├── redis/
│   └── object-storage/
├── logs/
│   ├── dashboard/
│   ├── control-plane-api/
│   ├── cloudflared/
│   ├── nginx/
│   ├── postgres/
│   └── redis/
└── secrets/
    ├── dashboard_session_secret
    ├── cloudflare_tunnel_token
    ├── control_plane_api_token
    ├── platform_database_url
    └── postgres_password
```

### Port allocation plan

| Service                         |      Port | Exposure                           |
| ------------------------------- | --------: | ---------------------------------- |
| NGINX                           |  80 / 443 | Public                             |
| Dashboard                       |      3000 | Private, proxied by NGINX          |
| Control Plane API               |      4100 | Private, proxied by NGINX / Tunnel |
| cloudflared metrics             |      2000 | Private only                       |
| Postgres                        |      5432 | Private only                       |
| Redis                           |      6379 | Private only                       |
| planner-slm → metrics-collector | 7201–7211 | Private only                       |

## Environment files

- Copy `.env.staging.example` into your staging environment configuration source.
- Copy `.env.production.example` to `/srv/apps/dashboard/.env.production` and `/srv/apps/control-plane-api/.env.production`.
- Keep secrets out of those files; store secrets under `/srv/secrets/*` and mount them through `docker-compose.vps.yml`.

## Docker secrets model

- `docker-compose.vps.yml` mounts secret files from `/srv/secrets/*`
- `postgres` reads `POSTGRES_PASSWORD_FILE`
- `dashboard` and `control-plane-api` export secret values from `/run/secrets/*` before start
- `cloudflared` reads the tunnel token from `/run/secrets/cloudflare_tunnel_token`
- Rotate secrets by replacing the file content and re-running `docker compose up -d`

## GitHub Actions deployment model

- `ci.yml` verifies every PR and push
- PRs from the same repository deploy the dashboard to **staging**
- Pushes to `main` deploy the dashboard to **production** and roll the VPS control-plane stack
- GitHub **environment** settings should hold the Cloudflare and VPS credentials

## Still manual outside the repo

- GitHub branch protection requiring `ci` before merge
- Cloudflare Tunnel creation and DNS routing in the Cloudflare dashboard
- End-to-end staging verification against real infrastructure
