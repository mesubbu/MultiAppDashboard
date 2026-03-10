# UI Screen List by User Journey

This journey map uses the screen IDs defined in `UI_SCREEN_LIST.md`. Shared feedback surfaces such as `SCR-023`, `SCR-024`, and `SCR-025` can appear in nearly any journey.

## Screen-to-journey coverage summary

| Screen ID | Screen name | Journey IDs |
|---|---|---|
| SCR-001 | Login & MFA | JNY-001, JNY-011 |
| SCR-002 | Context Switcher | JNY-001, JNY-003, JNY-004 |
| SCR-003 | Platform Overview | JNY-001, JNY-002, JNY-006, JNY-007 |
| SCR-004 | Tenants | JNY-003 |
| SCR-005 | Apps | JNY-003 |
| SCR-006 | Users | JNY-004 |
| SCR-007 | Agents Operations Console | JNY-005, JNY-007 |
| SCR-008 | Workflow Orchestrator | JNY-005 |
| SCR-009 | Tool Registry | JNY-002 |
| SCR-010 | AI Models Routing | JNY-002, JNY-006 |
| SCR-011 | AI Memory | JNY-008 |
| SCR-012 | Knowledge Graph Explorer | JNY-008 |
| SCR-013 | Events Monitor | JNY-002, JNY-007, JNY-009 |
| SCR-014 | Analytics | JNY-002 |
| SCR-015 | Observability | JNY-002, JNY-007, JNY-009 |
| SCR-016 | Audit Log | JNY-002, JNY-003, JNY-004, JNY-005, JNY-006, JNY-008, JNY-009, JNY-010 |
| SCR-017 | System Settings | JNY-010 |
| SCR-018 | Assistant Copilot | JNY-007 |
| SCR-019 | Research Operations | JNY-007, JNY-008 |
| SCR-020 | Market Signals & Insights | JNY-008 |
| SCR-021 | Recommendations Workbench | JNY-007, JNY-008 |
| SCR-022 | Outcome Feedback Capture | JNY-005, JNY-008 |
| SCR-023 | Global Loading State | JNY-001, JNY-011 |
| SCR-024 | Global Error Recovery | JNY-011 |
| SCR-025 | Toast Notifications | JNY-003, JNY-004, JNY-005, JNY-006, JNY-007, JNY-010 |

## JNY-001 — Sign in and establish scope
- **Goal:** Authenticate successfully and land in the correct tenant/app context.
- **Primary actor:** Any authenticated role.
- **Ordered screens visited:**
  1. `SCR-001 — Login & MFA`
  2. `SCR-023 — Global Loading State`
  3. `SCR-003 — Platform Overview`
  4. `SCR-002 — Context Switcher` *(if tenant/app scope must be changed after sign-in)*
- **Entry point:** User visits `/login` directly or is redirected there after session loss.
- **Exit point:** An authenticated dashboard view loads with the intended tenant/app scope active.
- **Branching / conditional screens:** MFA is mandatory for privileged roles; failed auth remains on `SCR-001`; if the default scope is wrong or unavailable, the user must adjust via `SCR-002`.

## JNY-002 — Review platform health and triage issues
- **Goal:** Determine whether the platform is healthy and identify the next investigative screen.
- **Primary actor:** `platform_owner`, `platform_admin`, `ops_admin`, `analyst`.
- **Ordered screens visited:**
  1. `SCR-003 — Platform Overview`
  2. `SCR-014 — Analytics` *(when the question is trend/performance oriented)*
  3. `SCR-013 — Events Monitor`
  4. `SCR-015 — Observability`
  5. `SCR-009 — Tool Registry` *(when the issue appears tool-related)*
  6. `SCR-010 — AI Models Routing` *(when the issue looks model-related)*
  7. `SCR-016 — Audit Log` *(when proof or timeline validation is needed)*
- **Entry point:** Sidebar navigation to Overview, or direct post-login landing.
- **Exit point:** Operator identifies root-cause direction and hands off to a specialist workflow.
- **Branching / conditional screens:** Trend questions branch to `SCR-014`; queue/event anomalies branch to `SCR-013`; service failures branch to `SCR-015`; tool errors or abnormal usage branch to `SCR-009`; routing/latency issues branch to `SCR-010`; governance review branches to `SCR-016`.

## JNY-003 — Manage tenants and applications
- **Goal:** Create, update, or review tenant/app records within the correct scope.
- **Primary actor:** `platform_owner`, `platform_admin`, `tenant_admin`.
- **Ordered screens visited:**
  1. `SCR-002 — Context Switcher`
  2. `SCR-004 — Tenants`
  3. `SCR-005 — Apps`
  4. `SCR-025 — Toast Notifications`
  5. `SCR-016 — Audit Log` *(optional validation)*
- **Entry point:** Sidebar navigation or follow-up from Overview quota/health context.
- **Exit point:** Requested catalog change is saved and visible in the scoped registry.
- **Branching / conditional screens:** `platform_owner` can create tenants; tenant-scoped admins may skip `SCR-004` and work directly in `SCR-005`; viewers stop at read-only review.

## JNY-004 — Administer user access and RBAC
- **Goal:** Add users or update role/status assignments safely.
- **Primary actor:** `platform_owner`, `platform_admin`, `tenant_admin`.
- **Ordered screens visited:**
  1. `SCR-002 — Context Switcher`
  2. `SCR-006 — Users`
  3. `SCR-025 — Toast Notifications`
  4. `SCR-016 — Audit Log`
- **Entry point:** Sidebar navigation to Users.
- **Exit point:** User access state is updated and auditable.
- **Branching / conditional screens:** Some changes require scoped tenant/app selection first; read-only users can inspect but not mutate.

## JNY-005 — Operate agents and recover workflows
- **Goal:** Inspect agent state and intervene in running work when needed.
- **Primary actor:** `platform_owner`, `platform_admin`, `ops_admin`.
- **Ordered screens visited:**
  1. `SCR-007 — Agents Operations Console`
  2. `SCR-008 — Workflow Orchestrator` *(when intervention spans multiple agents)*
  3. `SCR-022 — Outcome Feedback Capture`
  4. `SCR-025 — Toast Notifications`
  5. `SCR-016 — Audit Log`
- **Entry point:** Sidebar navigation to Agents, or escalation from Overview/Events.
- **Exit point:** Agent or workflow intervention is recorded and the operator has captured the result.
- **Branching / conditional screens:** Read-only roles stop at inspection inside `SCR-007`; single-agent remediation stays on `SCR-007`; multi-agent coordination branches to `SCR-008`.

## JNY-006 — Review and switch model routing
- **Goal:** Compare model health and change active routing when permitted.
- **Primary actor:** `platform_owner`, `platform_admin`, `ops_admin`.
- **Ordered screens visited:**
  1. `SCR-003 — Platform Overview` *(optional quick-entry point)*
  2. `SCR-010 — AI Models Routing`
  3. `SCR-025 — Toast Notifications`
  4. `SCR-016 — Audit Log`
- **Entry point:** Model status card from Overview or direct navigation to Models.
- **Exit point:** Active model is switched or a no-change decision is documented.
- **Branching / conditional screens:** Analysts can inspect but not switch; fallback routing can be triggered directly from the model workspace.

## JNY-007 — Investigate or act via the assistant
- **Goal:** Use the operator copilot to answer a question, analyze state, or propose an action.
- **Primary actor:** Any authenticated operator.
- **Ordered screens visited:**
  1. `SCR-018 — Assistant Copilot`
  2. `SCR-003 — Platform Overview` *(common context source)*
  3. `SCR-007 — Agents Operations Console` / `SCR-013 — Events Monitor` / `SCR-021 — Recommendations Workbench` *(depending on assistant suggestion)*
  4. `SCR-025 — Toast Notifications`
- **Entry point:** Assistant opened from the dashboard shell while on any protected route.
- **Exit point:** User receives an answer, suggestion, or successfully executed scoped action.
- **Branching / conditional screens:** Research-oriented prompts branch to `SCR-019`; event/incident prompts branch to `SCR-013` or `SCR-015`; action prompts may route into `SCR-007` or `SCR-021`.

## JNY-008 — Run research and turn it into operator recommendations
- **Goal:** Collect research, generate signals, review recommendations, and close the loop with feedback.
- **Primary actor:** `platform_owner`, `platform_admin`, `tenant_admin`, `ops_admin`, `analyst`.
- **Ordered screens visited:**
  1. `SCR-019 — Research Operations`
  2. `SCR-011 — AI Memory`
  3. `SCR-020 — Market Signals & Insights`
  4. `SCR-012 — Knowledge Graph Explorer`
  5. `SCR-021 — Recommendations Workbench`
  6. `SCR-022 — Outcome Feedback Capture`
  7. `SCR-016 — Audit Log`
- **Entry point:** Manual operator trigger, scheduled run review, or assistant-triggered research path.
- **Exit point:** Research output is reviewed, recommendations are generated, and outcomes are recorded where appropriate.
- **Branching / conditional screens:** Analysts may stop at `SCR-020` or `SCR-021` in read-only mode; operators can trigger research from the assistant instead of directly from `SCR-019`; graph review is only needed when recommendation rationale depends on entity relationships.

## JNY-009 — Investigate compliance, events, and observability evidence
- **Goal:** Correlate what happened, who changed what, and what services were affected.
- **Primary actor:** `platform_owner`, `platform_admin`, `tenant_admin`, `ops_admin`, `analyst`.
- **Ordered screens visited:**
  1. `SCR-013 — Events Monitor`
  2. `SCR-015 — Observability`
  3. `SCR-016 — Audit Log`
- **Entry point:** Incident review, security/compliance review, or escalation from Overview.
- **Exit point:** Operator has a defensible evidence trail and enough context for remediation or reporting.
- **Branching / conditional screens:** Service degradation branches more deeply into `SCR-015`; administrative change verification branches into `SCR-016` earlier.

## JNY-010 — Govern system-wide settings
- **Goal:** Review or adjust global security, runtime, and observability defaults.
- **Primary actor:** `platform_owner`.
- **Ordered screens visited:**
  1. `SCR-017 — System Settings`
  2. `SCR-025 — Toast Notifications`
  3. `SCR-016 — Audit Log`
- **Entry point:** Sidebar navigation to Settings.
- **Exit point:** A platform-level setting is reviewed or changed with governance traceability.
- **Branching / conditional screens:** Non-owner roles should hit a guarded access path rather than this journey.

## JNY-011 — Error and recovery flow
- **Goal:** Recover from loading, session, or rendering failures without losing user trust.
- **Primary actor:** Any user.
- **Ordered screens visited:**
  1. `SCR-023 — Global Loading State`
  2. `SCR-024 — Global Error Recovery`
  3. `SCR-001 — Login & MFA` *(if the failure is session-related)* or the originating screen *(if retry succeeds)*
- **Entry point:** Any protected route that fails to load or render.
- **Exit point:** User either returns to the intended workflow or re-authenticates cleanly.
- **Branching / conditional screens:** Transient fetch issues should resolve in place; expired/invalid sessions should redirect through `SCR-001` with context-preserving recovery where possible.