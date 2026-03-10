# UI Blueprint

## Scope and assumptions

- This blueprint is derived from `UI_SCREEN_LIST.md`, `UI_SCREEN_LIST_BY_JOURNEY.md`, `UI_SCREEN_AUDIT_MATRIX.md`, and `UI_GAPS_AND_RECOMMENDATIONS.md`.
- The documented gaps are treated as resolved. To reflect the fulfilled recommendations, the blueprint introduces six net-new screens: `SCR-026` to `SCR-031`.
- The existing route shell remains a protected dashboard with global top navigation, role-aware sidebar navigation, shared loading/error recovery, a context switcher, and a persistent assistant surface.
- Role-based landing is part of the blueprint: first-time or multi-scope users land in `SCR-002 Context Switcher`; otherwise default landing is role-aware.

## Module map

| Module | Screens |
|---|---|
| Core Platform | `SCR-001 Login & MFA`, `SCR-002 Context Switcher`, `SCR-018 Assistant Copilot`, `SCR-023 Global Loading State`, `SCR-024 Global Error Recovery`, `SCR-025 Toast Notifications`, `SCR-026 Auth Recovery`, `SCR-030 Access Denied / Request Access` |
| Dashboard | `SCR-003 Platform Overview`, `SCR-013 Events Monitor`, `SCR-014 Analytics`, `SCR-015 Observability`, `SCR-027 Incident Detail Workspace`, `SCR-031 Alerts Inbox` |
| Content Interaction | `SCR-011 AI Memory`, `SCR-012 Knowledge Graph Explorer`, `SCR-019 Research Operations`, `SCR-020 Market Signals & Insights`, `SCR-021 Recommendations Workbench`, `SCR-022 Outcome Feedback Capture`, `SCR-028 Research Run Detail`, `SCR-029 Recommendation Detail` |
| Administration | `SCR-004 Tenants`, `SCR-005 Apps`, `SCR-006 Users`, `SCR-007 Agents Operations Console`, `SCR-008 Workflow Orchestrator`, `SCR-009 Tool Registry`, `SCR-010 AI Models Routing`, `SCR-016 Audit Log` |
| Settings | `SCR-017 System Settings` |

## Global navigation system

### Top navigation

- Left zone: product identity, current module title, breadcrumb trail, and environment badge.
- Center zone: global search / command launcher for screens, entities, incidents, agents, recommendations, and saved views.
- Right zone: scope summary chip, `Context Switcher` trigger, alerts bell opening `SCR-031`, assistant trigger opening `SCR-018`, help/status entry, and user menu with profile, role summary, and sign out.
- Mobile behavior: hamburger opens the sidebar as a drawer, assistant becomes a bottom sheet, and alerts open full-screen.

### Sidebar navigation

- Persistent on desktop and grouped by module: Dashboard, Content Interaction, Administration, Settings.
- Scope-aware section at the top shows active tenant and app, last-used workspace, and a quick switch action into `SCR-002`.
- Navigation items are hidden when access is impossible and disabled with explanation only when a deep link targets an unavailable screen.
- Recommended order:
  - Dashboard: Overview, Alerts Inbox, Events, Analytics, Observability
  - Content Interaction: Research Operations, Market Signals & Insights, Recommendations, AI Memory, Knowledge Graph
  - Administration: Tenants, Apps, Users, Agents, Workflows, Tool Registry, AI Models Routing, Audit Log
  - Settings: System Settings

### Breadcrumbs

- Format: `Home / Module / Screen / Detail`.
- Detail screens append the selected entity or record identifier, for example `Dashboard / Alerts Inbox / Incident Detail / INC-4821`.
- Modal and drawer surfaces inherit the current page breadcrumb and add a terminal label in the header only, such as `Recommendations / Recommendation Detail / Capture Outcome`.
- Breadcrumbs always preserve active tenant/app scope in generated links.

### Deep links

- Deep links must preserve `tenant`, `app`, date range, filters, sort state, selected tab, and selected record.
- Shared conventions:
  - Page routes for primary screens, for example `/models`, `/events`, `/research`, `/settings`.
  - Detail routes for drill-ins, for example `/incidents/:incidentId`, `/research/runs/:runId`, `/recommendations/:recommendationId`.
  - Overlay state encoded via query parameters, for example `?assistant=open`, `?scope=open`, `?feedback=open`.
- Links from alerts, incidents, recommendations, and audit rows should be reversible so a user can navigate back to the originating filtered list.

### Role-based landing logic

- `platform_owner`, `platform_admin`: `SCR-003 Platform Overview`
- `ops_admin`: `SCR-013 Events Monitor`, falling back to `SCR-007 Agents Operations Console` if it was the last active workspace
- `tenant_admin`: `SCR-005 Apps` in the last-used tenant scope
- `analyst`: `SCR-014 Analytics`
- `viewer`: `SCR-013 Events Monitor` or `SCR-005 Apps`, depending on granted module access
- Any user with multiple valid scopes and no stored preference is first routed through `SCR-002 Context Switcher`

### Cross-cutting UX rules

- Risky mutations use confirmation modals or review panels with impact summary, affected scope, and audit notice before execution.
- Table-heavy screens use explicit row edit mode, dirty-state indicators, inline validation, and persistent post-save status.
- Live surfaces expose pause/resume, reduced-motion-friendly behavior, and equivalent list/table fallbacks.
- Failure handling distinguishes transient fetch errors, authorization errors, session expiry, and upstream outage.

## Core Platform

### SCR-001 — Login & MFA

1. **Screen purpose:** Authenticate operators and establish a secure session with password plus MFA when required.
2. **User role accessing the screen:** Public entry for all platform roles.
3. **Navigation entry points:** Direct `/login` visit, session timeout redirect, logout completion, and recovery return from `SCR-026`.
4. **Layout structure:** Centered auth card with brand header, credential form, MFA step, trust/help links, and a secondary support/status panel.
5. **Key UI components:** Brand block, email field, password field, MFA field, stepper, submit button, remember-device option, help links, status message area.
6. **Backend data required:** Session status, auth policy, MFA requirements, rate-limit state, supported recovery methods, status page summary.
7. **User actions:** Enter credentials, submit login, enter MFA code, request alternate MFA path, navigate to recovery, sign in after retry.
8. **Loading states:** Button spinner on submit, inline skeleton for MFA step transition, redirect loader while session initializes.
9. **Empty states:** First-visit neutral auth state with guidance and no prior device trust data.
10. **Error states:** Invalid credentials, expired MFA code, locked account, rate limit, unavailable identity provider, expired session redirect loop warning.

### SCR-026 — Auth Recovery

1. **Screen purpose:** Recover access through password reset, backup MFA, or operator support escalation.
2. **User role accessing the screen:** Public users who failed or cannot complete login.
3. **Navigation entry points:** `Forgot password` and `Need help signing in` links from `SCR-001`, deep links from expired recovery emails, and support escalation redirects.
4. **Layout structure:** Two-column recovery page with recovery method selector on the left and dynamic form / instruction panel on the right.
5. **Key UI components:** Recovery options list, email input, backup-code input, status banner, resend link, support escalation card, return-to-login button.
6. **Backend data required:** Recovery policy, recovery token status, email delivery result, backup MFA validation status, support contact metadata.
7. **User actions:** Request password reset, validate backup code, resend recovery message, open support path, return to login.
8. **Loading states:** In-form submit spinner, token validation skeleton, delayed-email info state.
9. **Empty states:** No token present yet; informational start state showing available recovery paths.
10. **Error states:** Invalid/expired reset token, unsupported recovery method, throttled resend, support channel unavailable.

### SCR-002 — Context Switcher

1. **Screen purpose:** Let authenticated users change tenant/app scope and refresh the workspace safely.
2. **User role accessing the screen:** All authenticated roles.
3. **Navigation entry points:** Top-nav scope chip, sidebar scope area, first-session landing rule, and deep links with mismatched scope.
4. **Layout structure:** Sheet or modal with scope summary, searchable tenant list, dependent app list, permission summary, and confirmation footer.
5. **Key UI components:** Search input, tenant selector, app selector, scope summary card, permission preview, confirm/cancel actions.
6. **Backend data required:** Accessible tenants, accessible apps for selected tenant, last-used scope, role permissions by scope.
7. **User actions:** Search scopes, select tenant, select app, confirm switch, reset to platform-wide view where permitted.
8. **Loading states:** Skeleton lists while scopes load, inline loader when dependent app list refreshes, full-route loading on confirm.
9. **Empty states:** No additional tenants/apps available, or no apps in selected tenant.
10. **Error states:** Scope fetch failure, unauthorized scope, stale scope after revocation, switch conflict when target app is archived.

### SCR-018 — Assistant Copilot

1. **Screen purpose:** Provide an always-available operator copilot for questions, analysis, and scoped action suggestions.
2. **User role accessing the screen:** All authenticated roles, with action capability gated by permission.
3. **Navigation entry points:** Top-nav assistant trigger, persistent shell rail on desktop, deep link query state, and contextual launch from alerts or agents.
4. **Layout structure:** Right-side drawer or desktop rail with conversation thread, scope context header, suggested prompts, tool/action cards, and composer.
5. **Key UI components:** Conversation list, prompt composer, suggestion chips, tool-call activity blocks, context badge, open-related-screen links.
6. **Backend data required:** Chat history, scoped memory context, suggested prompts, tool availability, action permissions, AI response stream state.
7. **User actions:** Ask a question, refine a prompt, run a suggested action, open linked screens, capture assistant output into workflow context.
8. **Loading states:** Streaming response state, tool-call progress indicators, initial history skeleton.
9. **Empty states:** Suggested prompt library and recent tasks when no conversation exists.
10. **Error states:** Assistant unavailable, tool invocation denied, response timeout, stale scope mismatch, partial result with retry guidance.

### SCR-023 — Global Loading State

1. **Screen purpose:** Prevent blank or jarring transitions while protected routes or large sections resolve.
2. **User role accessing the screen:** All users.
3. **Navigation entry points:** Route transition, protected-route validation, large data refresh, and context-switch completion.
4. **Layout structure:** Shell-preserving page skeleton with top bar placeholders, sidebar placeholders, and content-aware loading blocks.
5. **Key UI components:** Skeleton headers, KPI skeletons, table skeletons, live-region status text, optional cancel/back affordance.
6. **Backend data required:** Route/loading boundary status only.
7. **User actions:** Wait, go back when safe, or retry if loading exceeds threshold.
8. **Loading states:** Short, medium, and long-load variants with escalating explanatory copy.
9. **Empty states:** Not applicable; this is itself the transitional state.
10. **Error states:** Escalates into `SCR-024` if timeout or boundary failure occurs.

### SCR-024 — Global Error Recovery

1. **Screen purpose:** Recover gracefully from session, rendering, upstream, or data failures.
2. **User role accessing the screen:** All users.
3. **Navigation entry points:** Error boundaries, failed route loads, session expiry handling, and unrecoverable upstream responses.
4. **Layout structure:** Full-page recovery panel with failure explanation, likely cause, safe next actions, and last-known context summary.
5. **Key UI components:** Error banner, retry button, re-authenticate button, status-page link, support link, previous destination summary.
6. **Backend data required:** Error category, route context, correlation ID, last known session state, service health summary.
7. **User actions:** Retry, go to login, navigate to status/help, return to previous safe route.
8. **Loading states:** Retry-in-progress indicator and re-authentication redirect spinner.
9. **Empty states:** Not applicable; only appears when something failed.
10. **Error states:** Retry failure, repeated upstream outage, invalid recovery path, missing fallback destination.

### SCR-025 — Toast Notifications

1. **Screen purpose:** Provide lightweight success, warning, and error feedback for non-blocking outcomes.
2. **User role accessing the screen:** All authenticated roles.
3. **Navigation entry points:** Triggered after create, update, switch, schedule, or assistant action outcomes.
4. **Layout structure:** Stacked transient notifications anchored to the shell, with optional inline deep links and persistent log handoff for risky actions.
5. **Key UI components:** Toast stack, icon/severity marker, message body, action link, dismiss control, timer/progress indicator.
6. **Backend data required:** Mutation result payload, severity, correlation ID, optional linked audit record or destination.
7. **User actions:** Read, dismiss, open linked record, undo where supported.
8. **Loading states:** Pending toast state for long mutations and follow-up confirmation once complete.
9. **Empty states:** No active notifications.
10. **Error states:** Notification bus unavailable, message truncation fallback, escalated persistent banner for critical failures.

### SCR-030 — Access Denied / Request Access

1. **Screen purpose:** Explain missing permissions and guide the user toward safe next steps or access requests.
2. **User role accessing the screen:** Any authenticated user attempting a restricted route or action.
3. **Navigation entry points:** Guarded route redirect, denied deep link, or blocked high-risk action from another screen.
4. **Layout structure:** Centered denied-state page with permission summary, route context, suggested destinations, and request-access panel.
5. **Key UI components:** Permission message, current scope summary, suggested links, access request button/form, return button.
6. **Backend data required:** Required permission, current user roles, current scope, access request destination/policy.
7. **User actions:** Navigate to an allowed screen, copy the denied route, submit access request, change scope, return to prior page.
8. **Loading states:** Access request submission state and route-redirect transition state.
9. **Empty states:** Not applicable; the denied reason is always the primary content.
10. **Error states:** Cannot resolve permission metadata, access-request service unavailable, stale deep link after role change.

## Dashboard

### SCR-003 — Platform Overview

1. **Screen purpose:** Serve as the executive triage hub for platform KPIs, alerts, service health, model posture, and recent activity.
2. **User role accessing the screen:** `platform_owner`, `platform_admin`, `ops_admin`, `analyst`.
3. **Navigation entry points:** Role-based landing, sidebar Overview item, logo/home click, and assistant-suggested return path.
4. **Layout structure:** Dashboard shell with page header, KPI strip, active alerts rail, service health snapshot, model posture panel, and recent activity feed.
5. **Key UI components:** KPI cards, alert cards, health status list, model summary card, recent events list, quick-link actions.
6. **Backend data required:** Overview KPIs, alert summaries, service snapshot, model status, recent events, scoped health rollups.
7. **User actions:** Drill into incidents, open Alerts Inbox, jump to Events/Observability/Models/Audit, refresh dashboard, switch scope.
8. **Loading states:** KPI skeleton strip, section-level skeleton cards, partial refresh indicators for live summary panels.
9. **Empty states:** No active incidents, no significant alerts, or no scoped activity yet for the selected tenant/app.
10. **Error states:** Partial dashboard failure, stale KPI snapshot, section-level fetch errors, missing scope data.

### SCR-031 — Alerts Inbox

1. **Screen purpose:** Centralize alert review, ownership, status updates, and deep links into investigation workflows.
2. **User role accessing the screen:** All authenticated roles, with acknowledgment and assignment limited by permission.
3. **Navigation entry points:** Top-nav bell, Overview alert rail, assistant suggestion, and deep links from external notifications.
4. **Layout structure:** Full page on mobile and drawer/page hybrid on desktop with filter bar, alert list, selected alert preview, and action tray.
5. **Key UI components:** Severity filter chips, search, alert list, ownership/status badges, preview panel, acknowledge/assign buttons, related-links panel.
6. **Backend data required:** Alert feed, severity, ownership, status, timestamps, related incident IDs, linked routes, notification preferences.
7. **User actions:** Filter alerts, open incident, acknowledge, assign owner, mute or snooze where allowed, mark resolved.
8. **Loading states:** List skeleton, incremental pagination loader, preview panel shimmer on selection.
9. **Empty states:** No active alerts, or no alerts matching current severity/filter combination.
10. **Error states:** Alert feed unavailable, stale ownership conflict, permission denied on assignment, linked incident missing.

### SCR-013 — Events Monitor

1. **Screen purpose:** Show a real-time event stream for tenant, app, user, and agent activity to support live triage.
2. **User role accessing the screen:** `platform_owner`, `platform_admin`, `tenant_admin`, `ops_admin`, `analyst`, `viewer`.
3. **Navigation entry points:** Sidebar Events item, Overview drill-down, assistant recommendation, incident workspace evidence links.
4. **Layout structure:** Page header, live controls bar, filter rail, event list/table, selected event inspector, and cross-links to evidence screens.
5. **Key UI components:** Stream status indicator, pause/resume toggle, filter controls, event table/list, detail drawer, export/share link.
6. **Backend data required:** Event stream, event types, scope filters, stream health, selected event payload, related incident or agent links.
7. **User actions:** Pause/resume, filter, inspect event, open related agent/incident/audit entry, bookmark current view.
8. **Loading states:** Initial stream skeleton, reconnect indicator, filter refresh loader.
9. **Empty states:** No events in current time range or current scope.
10. **Error states:** Stream disconnected, replay unavailable, malformed event payload, permission loss during live session.

### SCR-014 — Analytics

1. **Screen purpose:** Provide trend-oriented KPI interpretation for growth, usage, and platform intelligence performance.
2. **User role accessing the screen:** `platform_owner`, `platform_admin`, `analyst`.
3. **Navigation entry points:** Sidebar Analytics item, Overview trend drill-downs, assistant suggestion, and recommendation context links.
4. **Layout structure:** Header with date controls, KPI summary row, trend charts, segmentation panels, and insights summary area.
5. **Key UI components:** Date-range picker, KPI tiles, charts, segmented breakdown cards, narrative insights panel, export action.
6. **Backend data required:** KPI rollups, time-series trends, usage segmentation, cohort or tenant breakdowns, comparison baselines.
7. **User actions:** Change date range, segment data, compare views, export summaries, jump to related signals or recommendations.
8. **Loading states:** Chart skeletons, KPI placeholders, segment refresh indicators.
9. **Empty states:** No data for current date range, no usage in selected scope, or insufficient history for trend comparison.
10. **Error states:** Aggregation fetch failure, partial chart data, unsupported segmentation request.

### SCR-015 — Observability

1. **Screen purpose:** Support incident detection and technical investigation through service health, live charts, client errors, and external tooling links.
2. **User role accessing the screen:** `platform_owner`, `platform_admin`, `ops_admin`.
3. **Navigation entry points:** Sidebar Observability item, Overview health cards, Events Monitor, Incident Detail, and assistant-directed triage.
4. **Layout structure:** Header, health summary row, live metric charts, client-error panel, external tools panel, and service detail tabs.
5. **Key UI components:** Service status cards, charts, log/error panels, embed/link launchers for Grafana/Loki/Prometheus, incident pivots.
6. **Backend data required:** Service health, live metrics, client errors, log query links, external dashboard metadata, alert correlations.
7. **User actions:** Inspect charts, change service focus, open external tools, jump to incident or audit evidence, refresh live view.
8. **Loading states:** Chart skeletons, reconnect banner, per-widget refresh indicator.
9. **Empty states:** No current incidents, no recent client errors, or no metrics for selected service/date range.
10. **Error states:** External embed unavailable, metrics backend timeout, incomplete client error feed, service metadata mismatch.

### SCR-027 — Incident Detail Workspace

1. **Screen purpose:** Correlate alerts, events, observability evidence, audit evidence, and affected entities into one investigation workspace.
2. **User role accessing the screen:** `platform_owner`, `platform_admin`, `tenant_admin`, `ops_admin`, `analyst`.
3. **Navigation entry points:** Overview alert cards, Alerts Inbox, Events Monitor evidence links, Observability anomaly links, Audit Log correlation links.
4. **Layout structure:** Incident header, timeline spine, evidence tabs, affected scope/entities panel, ownership/status sidebar, and action footer.
5. **Key UI components:** Incident summary card, status badges, timeline, evidence tabs, service impact card, linked agents list, recommendation panel.
6. **Backend data required:** Incident metadata, related alerts, event timeline, service health markers, audit records, affected tenant/app/users, recommendations.
7. **User actions:** Change incident status, assign owner, add note, open underlying evidence, launch recommendation review, export incident summary.
8. **Loading states:** Timeline skeleton, evidence tab placeholders, background enrichment indicator.
9. **Empty states:** Incident exists but automated evidence correlation has not produced linked artifacts yet.
10. **Error states:** Missing incident record, partially unavailable evidence source, stale cross-reference, permission mismatch on linked data.

## Content Interaction

### SCR-011 — AI Memory

1. **Screen purpose:** Expose memory scope health, vector growth, compaction cadence, and retention posture.
2. **User role accessing the screen:** `platform_owner`, `platform_admin`, `analyst`.
3. **Navigation entry points:** Sidebar AI Memory item, Research Operations lineage, assistant context inspection, recommendation rationale links.
4. **Layout structure:** Header, scope summary cards, memory inventory table, compaction/retention panels, and detail drawer for selected scope.
5. **Key UI components:** Scope filters, metric cards, memory table, retention badges, compaction history list, selected-scope detail panel.
6. **Backend data required:** Memory scopes, record counts, vector counts, compaction history, retention rules, embedding job status.
7. **User actions:** Filter by scope, inspect a memory segment, compare memory growth, open linked research run or recommendation.
8. **Loading states:** Metric skeletons, table placeholders, segment detail shimmer.
9. **Empty states:** No memory records for selected scope or feature not enabled in tenant.
10. **Error states:** Memory metrics unavailable, compaction history fetch failure, stale scope selection.

### SCR-012 — Knowledge Graph Explorer

1. **Screen purpose:** Let users traverse entities and relationships to discover context and supporting evidence.
2. **User role accessing the screen:** `platform_owner`, `platform_admin`, `analyst`.
3. **Navigation entry points:** Sidebar Knowledge Graph item, Research Operations, Signals, Recommendation Detail, and assistant recommendations.
4. **Layout structure:** Search/filter rail, graph canvas area, node inspector, saved views panel, and accessible tabular fallback.
5. **Key UI components:** Search field, filter chips, graph canvas, zoom controls, node detail panel, relationship legend, saved-view controls, table fallback.
6. **Backend data required:** Graph nodes, edges, presets, selected node context, path results, saved views.
7. **User actions:** Search entities, focus a node, expand a path, save a view, switch to table mode, open linked recommendation or research run.
8. **Loading states:** Canvas loader, node expansion spinner, inspector skeleton.
9. **Empty states:** No matching nodes for search/filter, or no relationships in the selected scope.
10. **Error states:** Graph query timeout, oversized path request, corrupted preset, unsupported rendering fallback.

### SCR-019 — Research Operations

1. **Screen purpose:** Launch manual research, manage schedules and triggers, and review run status across research workflows.
2. **User role accessing the screen:** `platform_owner`, `platform_admin`, `tenant_admin`, `ops_admin`, `analyst`.
3. **Navigation entry points:** Sidebar Research Operations item, assistant-triggered research path, recommendation follow-up, and incident investigation pivots.
4. **Layout structure:** Header with launch actions, run summary strip, scheduled jobs panel, runs table, artifacts preview rail, and detail links.
5. **Key UI components:** Launch-run button, schedule controls, trigger filters, runs table, status badges, artifact previews, run-detail links.
6. **Backend data required:** Research runs, schedules, triggers, status counts, artifact summaries, failure diagnostics preview.
7. **User actions:** Launch run, schedule or edit trigger, filter runs, open run detail, inspect downstream outputs.
8. **Loading states:** Table skeleton, schedule card shimmer, run-launch pending indicator.
9. **Empty states:** No research runs yet, or no runs matching the current status/filter.
10. **Error states:** Run launch failed, schedule validation error, stale trigger state, artifact preview unavailable.

### SCR-028 — Research Run Detail

1. **Screen purpose:** Provide a drill-down for one research run, including artifacts, source lineage, embeddings, and diagnostics.
2. **User role accessing the screen:** `platform_owner`, `platform_admin`, `tenant_admin`, `ops_admin`, `analyst`.
3. **Navigation entry points:** Research Operations run row, assistant deep link, Recommendation Detail rationale link, and incident workspace evidence link.
4. **Layout structure:** Run header, progress/status rail, artifact list, diagnostics panel, lineage map, downstream output links, and notes area.
5. **Key UI components:** Run summary card, artifact table/list, source metadata cards, diagnostic timeline, lineage graph/list, next-step links.
6. **Backend data required:** Run metadata, source documents, artifact records, embedding counts, error diagnostics, linked signals and recommendations.
7. **User actions:** Inspect artifacts, retry or relaunch where allowed, copy lineage link, open generated signals or recommendations.
8. **Loading states:** Artifact skeleton list, staged diagnostics loader, lineage map shimmer.
9. **Empty states:** Run completed with no artifacts, or artifacts quarantined/unavailable.
10. **Error states:** Run ID not found, artifact fetch failure, downstream lineage broken, retry disallowed.

### SCR-020 — Market Signals & Insights

1. **Screen purpose:** Convert research and event activity into interpretable signals, trends, and confidence-rated insights.
2. **User role accessing the screen:** `platform_owner`, `platform_admin`, `ops_admin`, `analyst`.
3. **Navigation entry points:** Sidebar Signals item, Research Operations completion links, Analytics drill-downs, and assistant recommendations.
4. **Layout structure:** Header, signal summary row, trend cards, insight list, segmentation controls, and rationale side panel.
5. **Key UI components:** Trend indicators, confidence badges, filters, insight cards, segmentation tabs, rationale preview, handoff buttons.
6. **Backend data required:** Signal summaries, confidence scores, time-series trend data, source lineage summary, segmentation dimensions.
7. **User actions:** Filter and segment, inspect insight rationale, open knowledge graph context, hand off to recommendations.
8. **Loading states:** Card skeletons, segmented refresh indicators, rationale panel shimmer.
9. **Empty states:** No meaningful signals in the current time range or scope.
10. **Error states:** Confidence scoring unavailable, segmentation failure, stale lineage links.

### SCR-021 — Recommendations Workbench

1. **Screen purpose:** Prioritize recommended actions, review rationale, and move operators toward approval, execution, or feedback.
2. **User role accessing the screen:** `platform_owner`, `platform_admin`, `tenant_admin`, `ops_admin`, `analyst`.
3. **Navigation entry points:** Sidebar Recommendations item, Signals handoff, Assistant Copilot, Incident Detail, and Agents/Workflow follow-up links.
4. **Layout structure:** Header, priority summary row, recommendation list, filters, selected recommendation preview, and action rail.
5. **Key UI components:** Priority chips, recommendation cards/table, confidence indicators, rationale preview, status badges, action buttons.
6. **Backend data required:** Recommendation list, rationale summaries, priority state, affected entities, approval state, linked incidents/workflows.
7. **User actions:** Filter by status or confidence, open recommendation detail, approve/reject where allowed, launch outcome capture, open related screens.
8. **Loading states:** List skeleton, preview panel shimmer, action-pending state.
9. **Empty states:** No recommendations for current scope or filters; no high-priority recommendations available.
10. **Error states:** Recommendation fetch failure, stale approval state, linked entity missing, action permission denied.

### SCR-029 — Recommendation Detail

1. **Screen purpose:** Present the full rationale, supporting evidence, affected entities, approvals, and feedback controls for a single recommendation.
2. **User role accessing the screen:** `platform_owner`, `platform_admin`, `tenant_admin`, `ops_admin`, `analyst`.
3. **Navigation entry points:** Recommendations Workbench row click, Incident Detail action panel, assistant suggestion, and deep link from notifications.
4. **Layout structure:** Recommendation header, rationale narrative, evidence tabs, impacted entities panel, approval/decision rail, and feedback launcher.
5. **Key UI components:** Summary card, confidence badge, evidence tabs, entity list, approval history, action buttons, outcome capture trigger.
6. **Backend data required:** Recommendation metadata, supporting signals, linked research run, graph relationships, approval history, prior outcomes.
7. **User actions:** Approve, reject, defer, assign, open supporting evidence, launch outcome capture, copy deep link.
8. **Loading states:** Detail skeleton, evidence tab shimmer, approval-history loader.
9. **Empty states:** Recommendation exists but supporting evidence has not finished enrichment yet.
10. **Error states:** Missing recommendation, unsupported approval state transition, broken evidence link, stale entity snapshot.

### SCR-022 — Outcome Feedback Capture

1. **Screen purpose:** Record whether a recommendation, workflow, or agent action succeeded, degraded, failed, or was blocked.
2. **User role accessing the screen:** `platform_owner`, `platform_admin`, `tenant_admin`, `ops_admin`.
3. **Navigation entry points:** Recommendations Workbench, Recommendation Detail, Agents Operations Console, Workflow Orchestrator, and deep-link query state.
4. **Layout structure:** Modal or sheet with source context summary, structured outcome form, notes area, follow-up actions, and submit footer.
5. **Key UI components:** Outcome status selector, notes input, source summary card, impact checkbox set, submit/cancel controls, audit note.
6. **Backend data required:** Source recommendation/workflow/action context, prior outcomes, allowed statuses, user identity, optional follow-up tasks.
7. **User actions:** Select outcome, enter notes, attach contextual metadata, submit, reopen source record.
8. **Loading states:** Submit spinner, source-context skeleton, optimistic success handoff into toast/audit link.
9. **Empty states:** No source selected; modal should not open without context.
10. **Error states:** Validation error, duplicate outcome conflict, source no longer valid, submission failure.

## Administration

### SCR-004 — Tenants

1. **Screen purpose:** Manage tenant lifecycle, plan, quota, spend, region, and health posture.
2. **User role accessing the screen:** `platform_owner`, `platform_admin`, `tenant_admin`, `viewer`.
3. **Navigation entry points:** Sidebar Tenants item, Overview quota/health drill-downs, and Audit Log back-links.
4. **Layout structure:** Header, fleet summary cards, filter toolbar, tenant table, row detail drawer, and create/edit modal where permitted.
5. **Key UI components:** Summary cards, search/filter toolbar, sortable table, row actions, detail drawer, create tenant modal, dirty-state banner.
6. **Backend data required:** Tenant list, plan/tier, quotas, spend, region, health status, pagination, filter metadata.
7. **User actions:** Filter, sort, inspect tenant, create tenant, edit plan/quota/status where allowed, deep link to apps or audit.
8. **Loading states:** Table skeleton, row-level save indicator, filter refresh shimmer.
9. **Empty states:** No tenants exist, or no tenants match current filters.
10. **Error states:** List fetch failure, inline validation failure, concurrent edit conflict, permission denied on write.

### SCR-005 — Apps

1. **Screen purpose:** Maintain the registry of tenant applications across runtime and environment variants.
2. **User role accessing the screen:** `platform_owner`, `platform_admin`, `tenant_admin`, `viewer`.
3. **Navigation entry points:** Sidebar Apps item, Tenants drill-down, role-based landing for tenant admins, and Audit Log links.
4. **Layout structure:** Header, scope summary, app metrics row, filters, app table/cards, detail drawer, and create/edit modal.
5. **Key UI components:** Scope badge, metrics cards, search/filter toolbar, app table, runtime badges, deployment status chips, edit modal.
6. **Backend data required:** App list, tenant relationship, environment/runtime metadata, region, deployment status, pagination.
7. **User actions:** Filter, inspect app, create app, edit app metadata, open related users or audit, switch scope.
8. **Loading states:** Table skeleton, scope-change refresh indicator, inline save state.
9. **Empty states:** No apps in current tenant or no apps matching filters.
10. **Error states:** Scope mismatch, app fetch failure, validation error on create/update, archived app conflict.

### SCR-006 — Users

1. **Screen purpose:** Provide the primary RBAC administration surface for user membership, roles, status, and recent activity.
2. **User role accessing the screen:** `platform_owner`, `platform_admin`, `tenant_admin`, `viewer`.
3. **Navigation entry points:** Sidebar Users item, Apps or Tenants cross-links, Audit Log links, and assistant recommendations.
4. **Layout structure:** Header, user summary cards, filter toolbar, user directory table, row detail drawer, add/edit modal.
5. **Key UI components:** Search, role/status filters, directory table, membership badges, activity chips, add-user modal, edit role panel.
6. **Backend data required:** User directory, role assignments, status, tenant/app membership, recent activity, pagination and filters.
7. **User actions:** Search, filter, inspect activity, add user, update role/status, resend invite where supported, open audit.
8. **Loading states:** Directory skeleton, row update spinner, membership refresh indicator.
9. **Empty states:** No users in scope or no users matching filter criteria.
10. **Error states:** Invite failure, role update denied, concurrent membership change, activity fetch failure.

### SCR-007 — Agents Operations Console

1. **Screen purpose:** Operate agents through a progressive workspace that starts with fleet overview and drills into selected agent detail.
2. **User role accessing the screen:** `platform_owner`, `platform_admin`, `tenant_admin`, `ops_admin`, `viewer`.
3. **Navigation entry points:** Sidebar Agents item, Overview alert cards, Events Monitor, Incident Detail, and assistant actions.
4. **Layout structure:** Header, fleet summary cards, filter rail, agent list/board, selected agent detail pane with tabs, and advanced action drawer.
5. **Key UI components:** Fleet KPI cards, board/list toggle, agent cards/table, logs tab, task history tab, decisions tab, control actions, budget/workflow editor.
6. **Backend data required:** Agents, task history, decisions, logs, performance, recommendation snippets, budgets, workflow versions.
7. **User actions:** Filter fleet, inspect agent, pause/restart/reroute, move stage, update budget, open related workflow or recommendation.
8. **Loading states:** Fleet skeletons, detail-pane shimmer, action-pending state, log-stream reconnect indicator.
9. **Empty states:** No agents in current scope, or no agents matching state/filter.
10. **Error states:** Action denied, stale agent state conflict, logs unavailable, workflow version mismatch.

### SCR-008 — Workflow Orchestrator

1. **Screen purpose:** Coordinate multi-agent workflows, scheduling, lifecycle updates, and aggregated outcomes.
2. **User role accessing the screen:** `platform_owner`, `platform_admin`, `ops_admin`.
3. **Navigation entry points:** Sidebar Workflows item, Agents Console escalation, Recommendation Detail action paths, and Audit Log links.
4. **Layout structure:** Header, workflow summary row, workflow list, selected workflow timeline, participant panel, and lifecycle action rail.
5. **Key UI components:** Workflow cards/table, schedule controls, participant list, lifecycle timeline, aggregation summary, action buttons.
6. **Backend data required:** Workflow list, participant agents, lifecycle state, schedule data, aggregated outcomes, linked recommendations.
7. **User actions:** Schedule workflow, inspect participants, update lifecycle, open outcome capture, pivot to audit or agents.
8. **Loading states:** List skeleton, participant timeline shimmer, schedule submit indicator.
9. **Empty states:** No workflows yet or no workflows matching the current state/filter.
10. **Error states:** Scheduling failure, participant resolution error, lifecycle update conflict, missing aggregate results.

### SCR-009 — Tool Registry

1. **Screen purpose:** Give operators governance visibility into tool contracts, permissions, risk, and usage.
2. **User role accessing the screen:** `platform_owner`, `platform_admin`, `viewer`.
3. **Navigation entry points:** Sidebar Tool Registry item, Overview tool anomaly drill-downs, Audit Log links.
4. **Layout structure:** Header, risk summary cards, filter toolbar, registry table, schema detail drawer, telemetry summary panel.
5. **Key UI components:** Search, risk filters, registry table, schema badge set, permission badges, usage charts, detail drawer.
6. **Backend data required:** Tool metadata, schemas, permissions, risk levels, safety guards, usage telemetry.
7. **User actions:** Filter tools, inspect schemas, compare permissions, review usage posture, open audit evidence.
8. **Loading states:** Table skeleton, detail shimmer, telemetry mini-chart loader.
9. **Empty states:** No tools registered in the current environment or no tools matching risk filter.
10. **Error states:** Schema fetch failure, usage telemetry unavailable, permission metadata mismatch.

### SCR-010 — AI Models Routing

1. **Screen purpose:** Govern active and fallback model routing using latency, cost, and error posture.
2. **User role accessing the screen:** `platform_owner`, `platform_admin`, `ops_admin`, `analyst`.
3. **Navigation entry points:** Sidebar AI Models Routing item, Overview model panel, Observability incident path, Audit Log, assistant guidance.
4. **Layout structure:** Header, active/fallback summary cards, comparison table/cards, performance trends, switch panel, and audit notice.
5. **Key UI components:** Model cards, latency/error charts, candidate selector, switch action, fallback summary, audit reference panel.
6. **Backend data required:** Model registry, active/fallback mappings, latency, token usage, error rate, switch history, candidate availability.
7. **User actions:** Compare models, inspect trends, switch active model where allowed, review fallback posture, open audit.
8. **Loading states:** Card skeletons, switch-pending state, trend chart shimmer.
9. **Empty states:** No eligible fallback model or no data for the selected model family.
10. **Error states:** Switch denied, stale model version, metrics unavailable, fallback configuration invalid.

### SCR-016 — Audit Log

1. **Screen purpose:** Provide a searchable, exportable compliance trail across admin, model, agent, workflow, and settings changes.
2. **User role accessing the screen:** `platform_owner`, `platform_admin`, `tenant_admin`, `ops_admin`.
3. **Navigation entry points:** Sidebar Audit Log item, post-mutation deep links, incident evidence links, and settings change reviews.
4. **Layout structure:** Header, filter toolbar, audit table, selected row detail drawer, export actions, and correlation links.
5. **Key UI components:** Search, actor/action/resource/date filters, audit table, export controls, detail drawer, related-screen links.
6. **Backend data required:** Audit rows, filter metadata, export state, correlation IDs, linked resources, user identity metadata.
7. **User actions:** Filter history, inspect row details, export CSV/JSON, open related tenant/user/model/workflow/incident screens.
8. **Loading states:** Table skeleton, export-pending state, detail drawer shimmer.
9. **Empty states:** No audit rows in current time range or selected scope.
10. **Error states:** Export failure, partially redacted row error, filter query timeout, linked resource unavailable.

## Settings

### SCR-017 — System Settings

1. **Screen purpose:** Review and manage global platform, security, AI, observability, and runtime defaults through a governed change flow.
2. **User role accessing the screen:** `platform_owner`.
3. **Navigation entry points:** Sidebar System Settings item, Audit Log links, and direct deep links from governed alerts or assistant suggestions.
4. **Layout structure:** Header, settings category nav, current-state panels, editable form sections, draft-change review panel, and publish footer.
5. **Key UI components:** Category tabs, settings forms, diff preview, approval checklist, rollback note, publish/cancel actions, audit summary.
6. **Backend data required:** System settings sections, config metadata, validation rules, draft state, change history, approval policy.
7. **User actions:** Review settings, edit drafts, compare before/after, confirm changes, discard draft, open audit history.
8. **Loading states:** Section skeletons, diff-generation loader, publish-pending indicator.
9. **Empty states:** No configurable values in the selected category or no pending draft changes.
10. **Error states:** Validation error, publish denied, conflicting draft version, rollback metadata unavailable.

## Navigation graph

### Public entry and recovery

- `SCR-001 Login & MFA` → `SCR-023 Global Loading State` → role-based landing screen
- `SCR-001 Login & MFA` ↔ `SCR-026 Auth Recovery`
- `SCR-024 Global Error Recovery` → `SCR-001 Login & MFA` when failure is session-related

### Global overlays and guardrails

- Any protected screen ↔ `SCR-002 Context Switcher`
- Any protected screen ↔ `SCR-018 Assistant Copilot`
- Any mutation-heavy screen → `SCR-025 Toast Notifications`
- Any unauthorized route/action → `SCR-030 Access Denied / Request Access`
- Any failed route/data boundary → `SCR-024 Global Error Recovery`

### Dashboard graph

- `SCR-003 Platform Overview` → `SCR-031 Alerts Inbox`, `SCR-013 Events Monitor`, `SCR-014 Analytics`, `SCR-015 Observability`, `SCR-010 AI Models Routing`, `SCR-016 Audit Log`, `SCR-027 Incident Detail Workspace`
- `SCR-031 Alerts Inbox` → `SCR-027 Incident Detail Workspace`, `SCR-013 Events Monitor`, `SCR-015 Observability`, `SCR-016 Audit Log`
- `SCR-013 Events Monitor` → `SCR-027 Incident Detail Workspace`, `SCR-007 Agents Operations Console`, `SCR-015 Observability`, `SCR-016 Audit Log`
- `SCR-014 Analytics` → `SCR-020 Market Signals & Insights`, `SCR-021 Recommendations Workbench`
- `SCR-015 Observability` → `SCR-027 Incident Detail Workspace`, `SCR-010 AI Models Routing`, `SCR-016 Audit Log`
- `SCR-027 Incident Detail Workspace` → `SCR-007 Agents Operations Console`, `SCR-021 Recommendations Workbench`, `SCR-016 Audit Log`

### Content interaction graph

- `SCR-019 Research Operations` → `SCR-028 Research Run Detail`, `SCR-011 AI Memory`, `SCR-020 Market Signals & Insights`, `SCR-021 Recommendations Workbench`
- `SCR-028 Research Run Detail` → `SCR-020 Market Signals & Insights`, `SCR-029 Recommendation Detail`
- `SCR-011 AI Memory` ↔ `SCR-019 Research Operations`, `SCR-021 Recommendations Workbench`
- `SCR-020 Market Signals & Insights` → `SCR-012 Knowledge Graph Explorer`, `SCR-021 Recommendations Workbench`
- `SCR-012 Knowledge Graph Explorer` ↔ `SCR-029 Recommendation Detail`, `SCR-020 Market Signals & Insights`
- `SCR-021 Recommendations Workbench` → `SCR-029 Recommendation Detail`, `SCR-022 Outcome Feedback Capture`, `SCR-007 Agents Operations Console`, `SCR-008 Workflow Orchestrator`
- `SCR-029 Recommendation Detail` → `SCR-022 Outcome Feedback Capture`, `SCR-019 Research Operations`, `SCR-012 Knowledge Graph Explorer`

### Administration graph

- `SCR-004 Tenants` ↔ `SCR-005 Apps`, `SCR-016 Audit Log`
- `SCR-005 Apps` ↔ `SCR-006 Users`, `SCR-016 Audit Log`
- `SCR-006 Users` → `SCR-016 Audit Log`
- `SCR-007 Agents Operations Console` ↔ `SCR-008 Workflow Orchestrator`, `SCR-022 Outcome Feedback Capture`, `SCR-016 Audit Log`
- `SCR-008 Workflow Orchestrator` → `SCR-022 Outcome Feedback Capture`, `SCR-016 Audit Log`, `SCR-021 Recommendations Workbench`
- `SCR-009 Tool Registry` → `SCR-016 Audit Log`
- `SCR-010 AI Models Routing` → `SCR-016 Audit Log`

### Settings graph

- `SCR-017 System Settings` → `SCR-016 Audit Log`, `SCR-025 Toast Notifications`

## Completion note

- This blueprint covers the documented inventory plus fulfilled recommendation screens so the platform now includes recovery, denied access, alerts management, incident correlation, research run drill-down, and recommendation drill-down as first-class experiences.