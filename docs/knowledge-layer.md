# Knowledge layer implementation notes

This project now treats the AI platform as three logical layers:

1. **Application layer** — Next.js dashboard and control-plane routes
2. **Intelligence layer** — agents, orchestration, memory, tool execution, and analysis services
3. **Knowledge layer** — PostgreSQL + pgvector tables for graph data, documents, embeddings, signals, and feedback

## Personal-use implementation bias

- Start with PostgreSQL on the VPS as the single source of truth
- Use pgvector inside Postgres before introducing a separate vector database
- Keep tenant/app fields available for compatibility, but allow single-user/fixed-scope operation
- Prefer simple function calls and local orchestration before a distributed event bus

## Current knowledge-layer tables

### Knowledge graph

- `entities`
- `relationships`
- `entity_attributes`

### Vector knowledge

- `documents`
- `embeddings`
- `vector_index_map`

### Agent intelligence

- existing `agents`
- `agent_tasks`
- `agent_performance`

### Platform intelligence

- `usage_patterns`
- `market_signals`
- `knowledge_events`

## Data flow

1. The dashboard or control-plane writes source records and actions.
2. Documents and events enter the knowledge layer.
3. Embeddings are generated into `embeddings` using pgvector.
4. Agents read `documents`, `entities`, `market_signals`, and `knowledge_events`.
5. Outcomes are written back through `agent_performance` and `knowledge_events`.

## Repo files to know

- Drizzle schema: `src/lib/db/schema.ts`
- SQL migrations: `drizzle/`
- DB seed script: `scripts/seed-db.mjs`
- Deployment notes: `docs/deployment.md`
- Reference architecture material: `training/README.md`