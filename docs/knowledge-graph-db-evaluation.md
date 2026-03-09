# Knowledge Graph DB Evaluation Note

## Summary

Recommendation: **stay on PostgreSQL for now** and treat a dedicated graph database as a later optimization once query complexity or graph size materially exceeds the current dashboard use cases.

If a dedicated graph store becomes necessary, prefer **Neo4j first** for this project’s likely needs; keep **Memgraph** as a strong alternative if low-latency streaming graph updates or simpler self-hosting becomes the main driver.

## Current implementation in this repo

The current knowledge graph is already production-shaped enough for the implemented dashboard features:

- graph storage lives in relational tables: `graph_nodes` and `graph_edges`
- tenant/app scope is enforced before graph traversal
- supported queries today are:
  - type filtering
  - shortest visible path via `path_from` + `path_to`
  - depth-limited neighborhood via `center_id` + `depth`
- the Postgres-backed control plane currently:
  - loads scoped nodes from `graph_nodes`
  - loads matching edges from `graph_edges`
  - applies path/depth traversal in application code

Relevant implementation points:

- schema: `src/lib/db/schema.ts`
- route/service query parsing: `src/lib/knowledge-graph.ts`, `src/app/api/admin/knowledge-graph/route.ts`
- control-plane traversal logic: `control-plane-api/src/knowledge-graph.mjs`
- Postgres fetch pattern: `control-plane-api/src/postgres-store.mjs`

## Why PostgreSQL is still the right default

For the current product surface, Postgres remains the simplest and lowest-risk choice because it gives us:

- one operational data store instead of introducing another stateful system
- straightforward tenant/app scoping alongside the rest of the control-plane data
- transactional writes for graph entities that likely originate from relational platform data anyway
- easy local development and deployment consistency with the rest of the stack
- enough performance for small-to-medium scoped subgraphs and dashboard exploration flows

The current graph queries are still **bounded, admin-facing, and scope-filtered**. They do not yet require:

- arbitrary-length pattern matching
- weighted pathfinding
- graph algorithms like PageRank, community detection, or similarity walks
- heavy concurrent analytical traversals across very large subgraphs

## Where the current approach will start to hurt

The present approach becomes expensive because traversal happens **after** fetching scoped nodes and edges into app memory.

That is acceptable for today’s scope-filtered exploration, but it will degrade when we need one or more of the following:

### Product/query complexity triggers

- repeated queries like “find all paths up to N hops with edge/category constraints”
- multi-hop recommendations or impact analysis across many node types
- ranking queries over many candidate paths
- graph analytics for centrality, clusters, influence, fraud rings, or anomaly neighborhoods
- more expressive Cypher/Gremlin-style pattern queries authored by product teams or AI agents

### Scale/latency triggers

- scoped graph responses routinely include **100k+ nodes** or **1M+ edges**
- path or neighborhood queries can no longer stay under the dashboard’s target latency budget
- the API needs pagination/streaming of graph neighborhoods instead of whole-subgraph fetches
- memory pressure appears because traversal requires large in-process adjacency maps

### Operational/data freshness triggers

- graph updates become high-frequency and event-driven rather than batch-like
- multiple services need graph-native queries directly instead of going through one control-plane adapter
- we need precomputed graph projections, graph algorithms, or graph-specific observability to operate safely

## Technology recommendation

### Default future choice: Neo4j

Prefer **Neo4j** if we cross the above thresholds because it best matches the most likely next-step needs:

- mature Cypher ecosystem and docs
- strong fit for path queries, neighborhood expansion, and relationship-heavy modeling
- better-known operational patterns, tooling, and onboarding materials
- clearer path to graph analytics and richer query semantics over time

This is the safer choice if the graph becomes a first-class platform capability for:

- AI agent reasoning over relationships
- fraud/risk networks
- recommendation or supply-chain dependency analysis
- operator-authored exploratory graph queries

### When Memgraph is attractive

Choose **Memgraph** instead if the project optimizes more for:

- low-latency streaming graph ingestion
- simpler self-hosted footprint
- real-time graph updates from event pipelines
- experimentation with graph procedures in a lightweight deployment model

Memgraph is compelling, but for this repo the main missing capability is not “real-time streaming graph first”; it is more likely “richer traversal semantics and graph analytics,” which makes Neo4j the more conservative recommendation.

## Suggested decision rule

Stay on Postgres until at least **two** of these become true:

1. dashboard or agent workloads need complex multi-hop traversal beyond current shortest-path / depth-limited queries
2. scoped graph fetches become a measurable latency or memory bottleneck
3. product roadmap requires graph-native analytics or recommendation features
4. teams need ad hoc graph query authoring without custom application-code traversal for each use case

## Low-cost steps before adopting a graph DB

Before adding a new database, first tighten the current implementation:

- add/verify indexes for `graph_nodes(tenant_id, app_id, type)` and `graph_edges(source)`, `graph_edges(target)`
- measure scoped graph sizes and P95 query latency in the control plane
- log path/depth query frequency and payload size
- define a target SLA for interactive graph exploration

If those steps keep the graph responsive, a dedicated graph DB is still premature.

## Phased migration path if needed later

1. keep Postgres as the source of truth for graph entities
2. dual-write or CDC-sync graph changes into Neo4j/Memgraph
3. move only advanced traversal endpoints to the graph DB first
4. keep simple scoped list/detail reads on Postgres where practical
5. cut over fully only after query correctness, latency, and ops runbooks are proven

## Decision

For Phase 4.4, the spike conclusion is:

- **do not adopt Neo4j or Memgraph yet**
- **document explicit adoption triggers now**
- **re-evaluate once graph workloads expand beyond the current admin exploration model**