CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS entities (
  id text PRIMARY KEY,
  tenant_id text REFERENCES tenants(id) ON DELETE CASCADE,
  app_id text REFERENCES tenant_apps(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  external_key text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'manual',
  confidence double precision NOT NULL DEFAULT 0,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS entities_scope_idx ON entities (tenant_id, app_id, entity_type);
CREATE INDEX IF NOT EXISTS entities_external_key_idx ON entities (external_key);

CREATE TABLE IF NOT EXISTS relationships (
  id text PRIMARY KEY,
  from_entity_id text NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  to_entity_id text NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  direction text NOT NULL DEFAULT 'directed',
  weight double precision NOT NULL DEFAULT 0,
  evidence_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS relationships_from_idx ON relationships (from_entity_id);
CREATE INDEX IF NOT EXISTS relationships_to_idx ON relationships (to_entity_id);

CREATE TABLE IF NOT EXISTS entity_attributes (
  id text PRIMARY KEY,
  entity_id text NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  attribute_key text NOT NULL,
  value_text text,
  value_json jsonb,
  source text NOT NULL DEFAULT 'manual',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS entity_attributes_entity_idx ON entity_attributes (entity_id, attribute_key);

CREATE TABLE IF NOT EXISTS documents (
  id text PRIMARY KEY,
  tenant_id text REFERENCES tenants(id) ON DELETE CASCADE,
  app_id text REFERENCES tenant_apps(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_uri text NOT NULL DEFAULT '',
  title text NOT NULL,
  content_text text NOT NULL,
  checksum text NOT NULL DEFAULT '',
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documents_scope_idx ON documents (tenant_id, app_id, created_at DESC);
CREATE INDEX IF NOT EXISTS documents_source_idx ON documents (source_type);

CREATE TABLE IF NOT EXISTS embeddings (
  id text PRIMARY KEY,
  document_id text NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  embedding_model text NOT NULL,
  chunk_index integer NOT NULL DEFAULT 0,
  chunk_text text NOT NULL,
  embedding_dimensions integer NOT NULL DEFAULT 1536,
  embedding_vector vector(1536) NOT NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS embeddings_document_idx ON embeddings (document_id, chunk_index);
CREATE INDEX IF NOT EXISTS embeddings_vector_cosine_idx ON embeddings USING hnsw (embedding_vector vector_cosine_ops);

CREATE TABLE IF NOT EXISTS vector_index_map (
  id text PRIMARY KEY,
  provider text NOT NULL,
  vector_table text NOT NULL DEFAULT 'embeddings',
  index_name text NOT NULL,
  distance_metric text NOT NULL DEFAULT 'cosine',
  dimensions integer NOT NULL DEFAULT 1536,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_reindexed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vector_index_map_name_idx ON vector_index_map (index_name);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id text PRIMARY KEY,
  agent_id text NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  task_type text NOT NULL,
  status text NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_summary text NOT NULL DEFAULT '',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_tasks_agent_idx ON agent_tasks (agent_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_performance (
  id text PRIMARY KEY,
  agent_id text NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  evaluation_window text NOT NULL,
  success_rate double precision NOT NULL DEFAULT 0,
  avg_latency_ms integer NOT NULL DEFAULT 0,
  avg_cost_usd double precision NOT NULL DEFAULT 0,
  task_count integer NOT NULL DEFAULT 0,
  feedback_score double precision NOT NULL DEFAULT 0,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_performance_agent_idx ON agent_performance (agent_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS usage_patterns (
  id text PRIMARY KEY,
  tenant_id text REFERENCES tenants(id) ON DELETE CASCADE,
  app_id text REFERENCES tenant_apps(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'operator',
  signal_key text NOT NULL,
  signal_value text NOT NULL,
  sample_count integer NOT NULL DEFAULT 0,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  window_started_at timestamptz,
  window_ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS usage_patterns_scope_idx ON usage_patterns (tenant_id, app_id, signal_key);

CREATE TABLE IF NOT EXISTS market_signals (
  id text PRIMARY KEY,
  tenant_id text REFERENCES tenants(id) ON DELETE CASCADE,
  app_id text REFERENCES tenant_apps(id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  subject text NOT NULL,
  direction text NOT NULL DEFAULT 'neutral',
  strength double precision NOT NULL DEFAULT 0,
  confidence double precision NOT NULL DEFAULT 0,
  summary text NOT NULL DEFAULT '',
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS market_signals_detected_idx ON market_signals (detected_at DESC);
CREATE INDEX IF NOT EXISTS market_signals_subject_idx ON market_signals (subject);

CREATE TABLE IF NOT EXISTS knowledge_events (
  id text PRIMARY KEY,
  tenant_id text REFERENCES tenants(id) ON DELETE CASCADE,
  app_id text REFERENCES tenant_apps(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  source_service text NOT NULL,
  source_ref text NOT NULL DEFAULT '',
  entity_id text REFERENCES entities(id) ON DELETE SET NULL,
  document_id text REFERENCES documents(id) ON DELETE SET NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS knowledge_events_created_idx ON knowledge_events (created_at DESC);
CREATE INDEX IF NOT EXISTS knowledge_events_type_idx ON knowledge_events (event_type);