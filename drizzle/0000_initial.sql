CREATE TABLE IF NOT EXISTS tenants (
  id text PRIMARY KEY,
  name text NOT NULL,
  tier text NOT NULL,
  status text NOT NULL,
  region text NOT NULL,
  apps integer NOT NULL DEFAULT 0,
  users integer NOT NULL DEFAULT 0,
  monthly_spend_usd double precision NOT NULL DEFAULT 0,
  event_quota_daily integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_apps (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  runtime text NOT NULL,
  environment text NOT NULL,
  status text NOT NULL,
  region text NOT NULL,
  agents_attached integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tenant_apps_tenant_idx ON tenant_apps (tenant_id);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  app_id text NOT NULL REFERENCES tenant_apps(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  name text NOT NULL,
  role text NOT NULL,
  status text NOT NULL,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_tenant_idx ON users (tenant_id);
CREATE INDEX IF NOT EXISTS users_app_idx ON users (app_id);

CREATE TABLE IF NOT EXISTS agents (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  app_id text NOT NULL REFERENCES tenant_apps(id) ON DELETE CASCADE,
  name text NOT NULL,
  state text NOT NULL,
  queue text NOT NULL,
  queue_depth integer NOT NULL DEFAULT 0,
  budget_usd double precision NOT NULL DEFAULT 0,
  budget_utilization_percent integer NOT NULL DEFAULT 0,
  avg_latency_ms integer NOT NULL DEFAULT 0,
  token_usage_1h integer NOT NULL DEFAULT 0,
  decisions_today integer NOT NULL DEFAULT 0,
  workflow_version text NOT NULL,
  last_task text NOT NULL DEFAULT '',
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  orchestration_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  tasks_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  decisions_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  logs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  execution_history_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agents_scope_idx ON agents (tenant_id, app_id);

CREATE TABLE IF NOT EXISTS tool_registry (
  name text PRIMARY KEY,
  schema_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  permissions_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_level text NOT NULL,
  usage_today integer NOT NULL DEFAULT 0,
  p95_ms integer NOT NULL DEFAULT 0,
  error_rate double precision NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS model_registry (
  key text PRIMARY KEY,
  service text NOT NULL,
  active_model text NOT NULL,
  fallback_model text NOT NULL,
  provider text NOT NULL,
  latency_ms integer NOT NULL DEFAULT 0,
  token_usage_1h integer NOT NULL DEFAULT 0,
  error_rate double precision NOT NULL DEFAULT 0,
  candidates_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_memory (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  app_id text NOT NULL REFERENCES tenant_apps(id) ON DELETE CASCADE,
  scope text NOT NULL,
  records_count integer NOT NULL,
  vector_count integer NOT NULL,
  last_compaction_at timestamptz
);

CREATE TABLE IF NOT EXISTS graph_nodes (
  id text PRIMARY KEY,
  type text NOT NULL,
  label text NOT NULL,
  metadata text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  tags_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  score double precision NOT NULL DEFAULT 0,
  health text NOT NULL DEFAULT 'healthy',
  tenant_id text,
  app_id text
);

CREATE TABLE IF NOT EXISTS graph_edges (
  id text PRIMARY KEY,
  source text NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  target text NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  label text NOT NULL,
  category text NOT NULL,
  strength double precision NOT NULL DEFAULT 0,
  evidence_count integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS events_outbox (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  app_id text NOT NULL REFERENCES tenant_apps(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor text,
  payload_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_scope_idx ON events_outbox (tenant_id, app_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY,
  tenant_id text,
  app_id text,
  user_id text,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  summary text,
  metadata_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS system_settings (
  section_title text NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  description text NOT NULL,
  scope text NOT NULL DEFAULT 'platform',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (section_title, key)
);

CREATE TABLE IF NOT EXISTS observability_services (
  name text PRIMARY KEY,
  layer text NOT NULL,
  status text NOT NULL,
  cpu_percent integer NOT NULL DEFAULT 0,
  memory_percent integer NOT NULL DEFAULT 0,
  restarts_24h integer NOT NULL DEFAULT 0,
  endpoint text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  session_id text PRIMARY KEY,
  user_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS login_audits (
  id text PRIMARY KEY,
  email text NOT NULL,
  user_id text,
  timestamp timestamptz NOT NULL,
  ip_address text NOT NULL,
  user_agent text NOT NULL,
  outcome text NOT NULL,
  reason text
);
CREATE INDEX IF NOT EXISTS login_audits_timestamp_idx ON login_audits (timestamp DESC);
