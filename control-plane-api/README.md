# Control Plane API Server

Standalone control-plane API service for the AI Platform Control Dashboard.

## Run locally

```bash
pnpm control-plane:dev
```

Default server:

- host: `127.0.0.1`
- port: `4100`
- bearer token: `local-control-plane-token`

## Required admin headers

```http
Authorization: Bearer local-control-plane-token
x-tenant-id: platform-root
x-app-id: control-dashboard
x-user-id: usr_platform_admin
```

## Endpoints

- `GET /health`
- `GET /admin/overview`
- `GET /admin/tenants`
- `GET /admin/apps`
- `GET /admin/users`
- `GET /admin/agents`
- `POST /admin/agents/:agentId/actions`
- `GET /admin/tools`
- `GET /admin/models`
- `POST /admin/models/switch`
- `GET /admin/memory`
- `GET /admin/knowledge-graph`
- `GET /admin/events`
- `GET /admin/analytics`
- `GET /admin/observability`
- `GET /admin/system`
