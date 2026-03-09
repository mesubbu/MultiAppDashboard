# AI_PLATFORM_MASTER_ARCHITECTURE.md

# Overview

This document defines the **master architecture** for a multi-application AI-enabled platform ecosystem.

The platform includes:

* Classifieds / Marketplace platform
* Financial Analytics platform
* AI Agent ecosystem
* Shared AI services
* Unified Knowledge Layer

The architecture is designed to run initially on a **single VPS**, while remaining **modular, scalable, and AI-native**.

Core principles:

* Clear separation of concerns
* Service-oriented AI architecture
* Shared intelligence across applications
* Self-learning knowledge infrastructure

---

# 1. High-Level System Architecture

The platform follows a **3-layer AI architecture**.

```
Users
  │
Applications
  │
AI Intelligence Layer
  │
Knowledge Layer
```

Expanded view:

```
Users
  │
  ▼
Application Layer
  │
  ▼
AI Gateway
  │
  ▼
Agent Orchestrator
  │
  ▼
AI Services
  │
  ▼
Knowledge Layer
```

---

# 2. The Three-Layer AI Platform Model

## Layer 1 — Application Layer

This layer contains the **products and user-facing systems**.

Examples:

* Marketplace / classifieds platform
* Financial analytics platform
* Contest or marketplace variants
* Admin dashboards
* Future mobile apps

Responsibilities:

* UI
* business logic
* authentication
* transaction processing
* API requests to AI services

Applications **do not contain AI logic directly**.

Instead they call the AI system via the **AI Gateway**.

Example requests:

```
recommend listings
detect fraud
generate category
analyze investment
```

---

## Layer 2 — Intelligence Layer

This is the **AI brain of the platform**.

It coordinates agents, reasoning, and data retrieval.

Services include:

* AI Gateway
* Agent Orchestrator
* Reasoning Engine
* Research Service
* Embeddings Service
* Memory Service
* Tool Service

This layer performs:

* AI decision making
* orchestration of agents
* model inference
* RAG workflows
* pattern detection

The intelligence layer reads and writes to the **Knowledge Layer**.

---

## Layer 3 — Knowledge Layer

The knowledge layer stores **persistent intelligence**.

It combines:

* structured data
* knowledge graphs
* vector embeddings
* historical learning

Technologies:

* PostgreSQL
* pgvector
* JSONB structured data

Responsibilities:

* memory
* semantic retrieval
* relationship storage
* agent learning
* platform analytics

All applications and AI agents contribute to the knowledge layer.

---

# 3. VPS Deployment Architecture

Initial deployment is designed for a **single VPS**.

## Directory Structure

```
/srv
   /apps
      marketplace
      analytics
      future-apps

   /ai-services
      ai-gateway
      reasoning-engine
      research-service
      embeddings-service
      memory-service
      agent-orchestrator
      tool-service

   /knowledge-layer
      postgres
      vector-store

   /logs
```

---

## Internal Ports

```
marketplace          localhost:5000
analytics            localhost:6000

ai-gateway           localhost:7100
reasoning-engine     localhost:7200
memory-service       localhost:7300
embeddings-service   localhost:7400
research-service     localhost:7500
agent-orchestrator   localhost:7600
tool-service         localhost:7700

postgres             localhost:5432
```

External traffic is routed via **NGINX reverse proxy**.

Only ports **80 and 443** are publicly exposed.

---

# 4. The Seven Core AI Services

## 1. AI Gateway

Central entry point for all AI requests.

Responsibilities:

* request routing
* prompt templates
* authentication
* rate limiting
* logging

Example API endpoints:

```
POST /ai/recommend
POST /ai/analyze
POST /ai/detect-fraud
```

---

## 2. Reasoning Engine

Handles AI reasoning tasks.

Capabilities:

* summarization
* planning
* decision making
* structured outputs
* tool invocation

Used by agents to produce final responses.

---

## 3. Research Service

Collects external information.

Sources:

* financial news
* market feeds
* web sources
* social sentiment
* platform activity

Outputs stored in:

* documents
* embeddings
* knowledge_events

---

## 4. Embeddings Service

Creates semantic embeddings for:

* listings
* research reports
* user queries
* agent notes

Stored using pgvector.

Used for:

* semantic search
* similarity discovery
* retrieval augmented generation.

---

## 5. Memory Service

Maintains contextual memory.

Stores:

* user preferences
* agent experience
* interaction history
* conversation context

Supports long-term learning.

---

## 6. Agent Orchestrator

Coordinates AI agents.

Responsibilities:

* task scheduling
* agent lifecycle
* multi-agent workflows
* result aggregation

Agents are executed as workers or scheduled jobs.

---

## 7. Tool Service

Provides callable tools for AI reasoning.

Examples:

* database queries
* statistical calculations
* market price lookup
* scraping tools
* analysis functions

Tools extend the capabilities of the reasoning engine.

---

# 5. The Knowledge Layer

The knowledge layer stores **all accumulated platform intelligence**.

It consists of three components.

---

## Knowledge Graph

Stores relationships between entities.

Examples:

```
User → interested_in → Vintage Watches
Agent → predicted → Tesla Stock
Listing → located_in → Mumbai
```

Tables used:

* entities
* relationships
* entity_attributes

---

## Vector Knowledge

Semantic representation of text data.

Examples:

* listing descriptions
* research reports
* agent observations
* user queries

Tables used:

* documents
* embeddings
* vector_index_map

---

## Structured Intelligence Tables

Store analytical insights and learning signals.

Examples:

* agent_performance
* market_signals
* user_behavior_patterns
* knowledge_events

---

# 6. Core Knowledge Layer Database Tables

The system relies on **12 core tables**.

## Knowledge Graph

```
entities
relationships
entity_attributes
```

## Vector Knowledge

```
documents
embeddings
vector_index_map
```

## Agent Intelligence

```
agents
agent_tasks
agent_performance
```

## Platform Intelligence

```
user_behavior_patterns
market_signals
knowledge_events
```

These tables support:

* RAG retrieval
* agent learning
* pattern discovery
* knowledge graph queries

---

# 7. The Five Core AI Agents

The platform begins with **five foundational agents**.

---

## 1. Research Agent

Collects external information.

Sources:

* financial news
* social sentiment
* web data
* platform events

Writes to:

```
documents
embeddings
knowledge_events
```

---

## 2. Insight Agent

Finds patterns and trends.

Detects:

* market signals
* demand spikes
* behavioral trends

Writes to:

```
market_signals
knowledge_events
```

---

## 3. Recommendation Agent

Produces user-facing intelligence.

Examples:

* listing recommendations
* price suggestions
* investment recommendations

Uses:

* embeddings similarity
* knowledge graph
* market signals
* user behavior.

---

## 4. Fraud / Anomaly Agent

Detects suspicious behavior.

Examples:

* fake listings
* price manipulation
* spam accounts
* pump-and-dump patterns

Outputs alerts as knowledge events.

---

## 5. Strategy Learning Agent

Learns from outcomes.

Tracks:

* agent success rates
* prediction accuracy
* profitable strategies

Updates:

```
agent_performance
knowledge_events
```

This enables **self-improving agents**.

---

# 8. Example AI Query Flow

Example user question:

```
"What stocks look promising?"
```

System flow:

```
User
  │
Application
  │
AI Gateway
  │
Agent Orchestrator
  │
Research Agent
  │
Knowledge Retrieval
  │
Embeddings Search
  │
Reasoning Engine
  │
Recommendation Generated
```

Response returned to the application.

---

# 9. Self-Learning Feedback Loop

The platform improves through continuous learning.

```
Agent action
      ↓
Outcome recorded
      ↓
Knowledge layer updated
      ↓
Future reasoning improved
```

No model retraining is required for many improvements.

Learning occurs through **knowledge accumulation**.

---

# 10. Long-Term Vision

The system evolves into a **shared intelligence platform**.

Multiple applications contribute knowledge:

```
classifieds platform
financial analytics platform
agent ecosystem
future applications
```

All feed the same knowledge infrastructure.

Over time this creates:

```
compound intelligence
self-improving agents
cross-platform insights
```

The architecture supports expansion from:

```
single VPS
```

to

```
distributed microservice infrastructure
```

without redesign.

---

# Final Architectural Principle

The platform follows this core structure:

```
Applications
      ↓
AI Intelligence Layer
      ↓
Knowledge Layer
```

Applications generate data.

AI services interpret the data.

The knowledge layer stores accumulated intelligence.

Together they create a **self-improving AI-native platform ecosystem**.

If you'd like, I can also give you **one more extremely practical document** that pairs perfectly with this:

**`AI_PLATFORM_IMPLEMENTATION_ROADMAP.md`**

It breaks this entire architecture into **a realistic step-by-step build order (about 10–12 stages)** so you don't try to build everything at once.

