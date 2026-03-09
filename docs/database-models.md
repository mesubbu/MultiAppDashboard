# Example Database Models

The dashboard is UI-first, but the following entities are recommended for the platform control plane.

## Core relational entities

- `tenants`
- `tenant_apps`
- `users`
- `roles`
- `permissions`
- `agents`
- `agent_runs`
- `tool_registry`
- `model_registry`
- `ai_memory`
- `events_outbox`
- `audit_logs`
- `system_settings`

## Example SQL models

```sql
create table tenants (
  id text primary key,
  name text not null,
  tier text not null,
  status text not null,
  region text not null,
  created_at text not null
);

create table tenant_apps (
  id text primary key,
  tenant_id text not null references tenants(id),
  name text not null,
  runtime text not null,
  environment text not null,
  status text not null,
  region text not null,
  created_at text not null
);

create table users (
  id text primary key,
  tenant_id text not null,
  app_id text not null,
  email text not null,
  name text not null,
  status text not null,
  last_seen_at text,
  created_at text not null
);

create table agents (
  id text primary key,
  tenant_id text not null,
  app_id text not null,
  name text not null,
  state text not null,
  queue text not null,
  budget_usd real not null,
  workflow_version text not null,
  updated_at text not null
);

create table tool_registry (
  name text primary key,
  schema_json text not null,
  permissions_json text not null,
  risk_level text not null,
  updated_at text not null
);

create table model_registry (
  key text primary key,
  service text not null,
  active_model text not null,
  fallback_model text not null,
  provider text not null,
  updated_at text not null
);

create table ai_memory (
  id text primary key,
  tenant_id text not null,
  app_id text not null,
  scope text not null,
  records_count integer not null,
  vector_count integer not null,
  last_compaction_at text
);

create table events_outbox (
  id text primary key,
  tenant_id text not null,
  app_id text not null,
  event_type text not null,
  actor text,
  payload_json text not null,
  created_at text not null
);

create table audit_logs (
  id text primary key,
  tenant_id text,
  app_id text,
  user_id text,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  metadata_json text,
  created_at text not null
);

create table system_settings (
  key text primary key,
  value text not null,
  scope text not null,
  updated_at text not null
);
```

## Graph-backed entities

Recommended graph nodes:

- `User`
- `Vendor`
- `Category`
- `Listing`
- `Agent`
- `Skill`
- `Location`

Recommended graph edges:

- `SEARCHES`
- `OFFERS`
- `LOCATED_IN`
- `MONITORS`
- `USES`
- `PURCHASED`
