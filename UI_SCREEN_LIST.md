# UI Screen Inventory

Derived from `SYSTEM_SPEC.md`, `ROUTES_AND_WORKFLOWS.md`, `README.md`, `docs/architecture.md`, and the current Next.js dashboard route/component structure. This inventory includes both implemented screens and product-critical screens explicitly implied by the documented workflows and API surface.

## Core Platform

| Screen ID | Screen name | Short description | Primary user role(s) | Platform targets | Screen type | Priority |
|---|---|---|---|---|---|---|
| SCR-002 | Context Switcher | Lets authenticated users change active tenant/app scope and refresh all scoped data. It is central to the platform’s multi-tenant operating model. | All authenticated roles | Both | Sheet | P1 |
| SCR-018 | Assistant Copilot | Persistent operator copilot for chat, investigation, and scoped admin command suggestions using memory context. It supports both read and action-oriented workflows. | All authenticated roles | Both | Drawer | P2 |
| SCR-023 | Global Loading State | Shared skeleton/loading surface shown while dashboard routes or large data sections resolve. It prevents blank states during protected-route navigation. | All users | Both | Page | P1 |
| SCR-024 | Global Error Recovery | Shared recovery surface for route or boundary failures with retry affordances. It should help users recover from upstream, session, or rendering issues. | All users | Both | Page | P1 |
| SCR-025 | Toast Notifications | Transient system feedback for create, update, switch, and assistant outcomes. It confirms success, warnings, and errors without forcing full-page context switches. | All authenticated roles | Both | Toast | P1 |

## Dashboard

| Screen ID | Screen name | Short description | Primary user role(s) | Platform targets | Screen type | Priority |
|---|---|---|---|---|---|---|
| SCR-003 | Platform Overview | Executive command-center view showing KPIs, alerts, model posture, service health, and recent operational activity. It acts as the main triage hub for the platform. | `platform_owner`, `platform_admin`, `ops_admin`, `analyst` | Both | Page | P1 |
| SCR-013 | Events Monitor | Real-time event stream for tenant, app, user, and agent activity with filters and pause/resume controls. It supports live operational triage and event-driven investigation. | `platform_owner`, `platform_admin`, `tenant_admin`, `ops_admin`, `analyst`, `viewer` | Both | Page | P1 |
| SCR-014 | Analytics | KPI and trend screen for tenant growth, tool usage, and platform intelligence rollups. It helps analytical users move from raw activity to performance interpretation. | `platform_owner`, `platform_admin`, `analyst` | Both | Page | P2 |
| SCR-015 | Observability | Health and monitoring screen for services, client errors, live infrastructure charts, and links to Grafana/Loki/Prometheus. It supports incident detection and investigation. | `platform_owner`, `platform_admin`, `ops_admin` | Both | Page | P1 |

## Content Interaction

| Screen ID | Screen name | Short description | Primary user role(s) | Platform targets | Screen type | Priority |
|---|---|---|---|---|---|---|
| SCR-011 | AI Memory | Read-oriented view of memory scopes, vector growth, compaction cadence, and retention posture. It gives operators confidence in retrieval context quality and memory health. | `platform_owner`, `platform_admin`, `analyst` | Web | Page | P2 |
| SCR-012 | Knowledge Graph Explorer | Interactive relationship workbench for traversing entities, filters, presets, and connected paths. It supports intelligence discovery across users, listings, vendors, agents, and locations. | `platform_owner`, `platform_admin`, `analyst` | Web | Page | P2 |
| SCR-019 | Research Operations | Control surface for launching manual research runs, managing schedules/triggers, and inspecting collected research artifacts. It underpins the documented research workflow in the system spec. | `platform_owner`, `platform_admin`, `tenant_admin`, `ops_admin`, `analyst` | Web | Page | P2 |
| SCR-020 | Market Signals & Insights | Insight-focused screen for reviewing signal generation output, trend direction, confidence, and summary context. It converts research and event activity into interpretable intelligence. | `platform_owner`, `platform_admin`, `ops_admin`, `analyst` | Web | Page | P2 |
| SCR-021 | Recommendations Workbench | Prioritized action screen for reviewing recommendations, rationale, confidence, and related context from research/insight outputs. It is the main decision-support surface for operators. | `platform_owner`, `platform_admin`, `tenant_admin`, `ops_admin`, `analyst` | Web | Page | P2 |

## Administration

| Screen ID | Screen name | Short description | Primary user role(s) | Platform targets | Screen type | Priority |
|---|---|---|---|---|---|---|
| SCR-004 | Tenants | Tenant fleet management screen covering lifecycle, plan/tier, region, quota, spend, and health posture. It is the root administrative view for multi-tenant governance. | `platform_owner`, `platform_admin`, `tenant_admin`, `viewer` | Web | Page | P1 |
| SCR-005 | Apps | Registry screen for tenant applications across runtime and environment variants. It supports application onboarding, status review, and scoped operational oversight. | `platform_owner`, `platform_admin`, `tenant_admin`, `viewer` | Web | Page | P1 |
| SCR-006 | Users | User directory for reviewing role assignments, status, tenancy/app membership, and recent activity. It is the primary RBAC administration surface. | `platform_owner`, `platform_admin`, `tenant_admin`, `viewer` | Web | Page | P1 |
| SCR-007 | Agents Operations Console | High-density operational console for agent state, orchestration stage, logs, task history, budgets, workflow versions, and direct control actions. It is the core operational action screen. | `platform_owner`, `platform_admin`, `tenant_admin`, `ops_admin`, `viewer` | Web | Page | P1 |
| SCR-008 | Workflow Orchestrator | Multi-agent workflow screen for scheduling workflows, tracking participants, managing lifecycle updates, and reviewing aggregated outcomes. It formalizes orchestration beyond single-agent control. | `platform_owner`, `platform_admin`, `ops_admin` | Web | Page | P2 |
| SCR-009 | Tool Registry | Governance screen for tool schemas, permissions, risk levels, safety guards, and usage telemetry. It gives operators visibility into tool exposure and risk. | `platform_owner`, `platform_admin`, `viewer` | Web | Page | P2 |
| SCR-010 | AI Models Routing | Model routing screen for comparing active and fallback models, reviewing latency/error posture, and switching active models where permitted. It operationalizes centralized model governance. | `platform_owner`, `platform_admin`, `ops_admin`, `analyst` | Web | Page | P1 |
| SCR-016 | Audit Log | Searchable and exportable compliance trail for admin actions, model switches, agent actions, and client errors. It supports both governance review and post-incident analysis. | `platform_owner`, `platform_admin`, `tenant_admin`, `ops_admin` | Web | Page | P1 |
| SCR-022 | Outcome Feedback Capture | Focused outcome-entry surface for recording whether a recommendation, workflow, or agent action succeeded, degraded, failed, or was blocked. It closes the self-learning loop described in the spec. | `platform_owner`, `platform_admin`, `tenant_admin`, `ops_admin` | Both | Modal | P2 |

## Settings

| Screen ID | Screen name | Short description | Primary user role(s) | Platform targets | Screen type | Priority |
|---|---|---|---|---|---|---|
| SCR-017 | System Settings | Governance screen for global platform, auth, AI, observability, and security defaults. It should support controlled review and update of system-wide configuration. | `platform_owner` | Web | Page | P2 |

## Authentication & Onboarding

| Screen ID | Screen name | Short description | Primary user role(s) | Platform targets | Screen type | Priority |
|---|---|---|---|---|---|---|
| SCR-001 | Login & MFA | Public authentication screen for email, password, and MFA code entry. It establishes the authenticated session and initial dashboard access. | All roles | Both | Page | P1 |