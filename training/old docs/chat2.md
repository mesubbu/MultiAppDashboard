
---

# Generate the Platform Control Dashboard

```
You are a senior platform architect and full-stack engineer.

Your task is to design and implement a production-grade "AI Platform Control Dashboard" for a multi-tenant AI-native platform.

The system architecture is as follows:

EDGE LAYER
Cloudflare Workers (API Gateway)
Durable Objects
D1 (multi-tenant relational DB)
KV cache
R2 object storage
Workers AI
Event queues

AI ORCHESTRATION LAYER (VPS cluster, Docker containers)

planner-slm
sql-brain
agent-brain
embedding-engine

tool-executor
ai-memory
agent-runtime
platform-intelligence
knowledge-graph
control-plane-api
observability-api

All apps are multi-tenant. Every request carries:
tenant_id
app_id
user_id

The control dashboard must allow administrators to manage the entire platform.

The dashboard will be implemented as a Next.js application (React + Tailwind).

It will communicate with a Control Plane API which orchestrates the platform.

------------------------------------------------

Your task:

Design and generate the entire dashboard system including:

1) SYSTEM ARCHITECTURE

Describe:

- UI architecture
- control plane API architecture
- data flow between UI and services
- authentication and RBAC model

------------------------------------------------

2) DASHBOARD MODULES

Design the following sections:

Platform Overview
Tenants
Apps
Users
Agents
Tool Registry
AI Models
AI Memory
Knowledge Graph
Events
Analytics
Observability
System Settings

For each module define:

- page layout
- components
- API endpoints
- database entities
- key interactions

------------------------------------------------

3) UI STRUCTURE

Define the Next.js project structure:

example:

/app
/components
/modules
/services
/hooks
/types

Define reusable components:

DashboardLayout
Sidebar
MetricsCards
EventStream
GraphExplorer
AgentMonitor
ToolRegistryTable
TenantManager
ModelMonitor

------------------------------------------------

4) CONTROL PLANE API

Design REST or GraphQL endpoints for:

/admin/tenants
/admin/apps
/admin/tools
/admin/agents
/admin/models
/admin/knowledge-graph
/admin/events
/admin/analytics
/admin/system

Include request/response schemas.

------------------------------------------------

5) KNOWLEDGE GRAPH EXPLORER

Provide a UI to visualize relationships between:

users
vendors
categories
listings
agents
skills
locations

Use a graph visualization library such as:

Cytoscape.js
React Flow

Define graph queries and visualization interactions.

------------------------------------------------

6) AGENT MANAGEMENT UI

Display:

running agents
agent tasks
agent decisions
logs
execution history

Allow actions:

pause agent
restart agent
change budget
edit workflow

------------------------------------------------

7) TOOL REGISTRY UI

Show all platform tools.

Example tool format:

domain.action.object

Example:

marketplace.create.listing
marketplace.search.listings
messages.send.message

Each tool must display:

schema
permissions
risk level
usage metrics

------------------------------------------------

8) EVENT STREAM VIEWER

Create a real-time event dashboard showing platform events:

listing_created
order_placed
message_sent
agent_triggered

Include filtering by:

tenant
app
event type

------------------------------------------------

9) AI MODEL MONITOR

Show metrics for:

planner model
sql model
agent model
embedding model

Display:

latency
token usage
error rate

Allow switching models.

------------------------------------------------

10) OBSERVABILITY

Integrate with:

Prometheus
Grafana
Loki

Show:

system health
queue backlog
AI latency
container status

------------------------------------------------

11) DEPLOYMENT

Provide instructions for:

- running locally
- connecting to the Control Plane API
- deploying to Cloudflare
- connecting to VPS services

------------------------------------------------

12) OUTPUT FORMAT

Provide:

1) architecture explanation
2) full project structure
3) key React components
4) example API routes
5) example database models
6) setup instructions

The result should be a production-grade starting point for building the AI Platform Control Dashboard.

Focus on clarity, modular architecture, and extensibility.
```

---

# Why This Prompt Works

It forces the model to produce **four critical things**:

1️⃣ **System architecture**
2️⃣ **UI design**
3️⃣ **backend APIs**
4️⃣ **actual code structure**

Without this structure, models usually produce **fragmented dashboards**.

---

# One Tip When Using GPT-5.4

After the first response, ask it:

```
Now generate the full Next.js project skeleton and key components.
```

Then:

```
Now generate the control-plane API server.
```

Then:

```
Now generate the graph explorer and agent dashboard modules.
```

Break generation into **3–4 steps**, not one.

---

If you'd like, I can also give you **one extremely powerful prompt extension** that will make the dashboard **AI-assisted** — meaning the admin can literally **run the entire platform by typing commands** in the UI. That’s where your architecture becomes really interesting.

