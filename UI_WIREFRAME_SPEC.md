# UI Wireframe Specification

## Scope

- This specification is based on `UI_BLUEPRINT.md` and the source UI inventory and journey documents.
- Reusable component slots are marked with `[DS: ...]` placeholders for future design-system mapping.
- Protected screens assume the shared dashboard shell unless otherwise noted.
- Net-new fulfilled-recommendation screens included here: `SCR-026`, `SCR-027`, `SCR-028`, `SCR-029`, `SCR-030`, `SCR-031`.

## Global shell patterns

### Authenticated page shell

- Navbar
  - [DS: Breadcrumbs]
  - [DS: ModuleTitle]
  - [DS: SearchCommand]
  - [DS: ScopeChip]
  - [DS: IconButton] Alerts
  - [DS: IconButton] Assistant
  - [DS: UserMenu]
- Sidebar
  - [DS: ScopeSummary]
  - [DS: ScopeSwitcherTrigger]
  - [DS: ModuleNav]
  - [DS: SavedViewsList]
- Content Area
  - [DS: PageHeader]
  - Screen-specific content blocks

### Detail page shell

- Navbar
  - [DS: Breadcrumbs]
  - [DS: BackButton]
  - [DS: ScopeChip]
  - [DS: IconButton] Alerts
  - [DS: IconButton] Assistant
- Sidebar
  - Same as authenticated page shell
- Content Area
  - [DS: DetailHeader]
  - [DS: Tabs] or [DS: SplitPanel]
  - [DS: ActionRail]

### Overlay patterns

- Modal
  - [DS: ModalHeader]
  - [DS: FormSection] or [DS: SummaryPanel]
  - [DS: ModalFooter]
- Drawer / Sheet
  - [DS: DrawerHeader]
  - [DS: FilterBar] or [DS: ConversationFeed]
  - [DS: DrawerFooter]

## Core Platform

### SCR-001 — Login & MFA

- Purpose: Authenticate the user and complete MFA before entering the protected workspace.
- Layout Structure:
  - Navbar
    - [DS: BrandBar]
    - [DS: HelpLinks]
    - [DS: StatusLink]
  - Sidebar
    - None
  - Content Area
    - [DS: AuthShell]
      - [DS: AuthCard]
        - [DS: Stepper]
        - [DS: TextField] Email
        - [DS: PasswordField]
        - [DS: OTPField]
        - [DS: Checkbox] Remember device
        - [DS: Button] Sign in
        - [DS: InlineLinkGroup] Forgot password / Recovery help
      - [DS: SupportPanel]
        - [DS: StatusBadge]
        - [DS: HelpList]
- Data sources required from backend: Session status, auth policy, MFA requirement, rate-limit state, recovery methods.
- User actions: Submit credentials, enter MFA, request alternate recovery, navigate to recovery, return after error.
- Loading states: Submit spinner, MFA-step transition skeleton, redirect loader.
- Empty states: Fresh login form with no remembered device context.
- Error states: Invalid credentials, invalid MFA, locked account, rate limit, auth provider outage.

### SCR-026 — Auth Recovery

- Purpose: Restore access through password reset, backup MFA, or support escalation.
- Layout Structure:
  - Navbar
    - [DS: BrandBar]
    - [DS: BackLink] Return to login
  - Sidebar
    - None
  - Content Area
    - [DS: TwoColumnLayout]
      - [DS: RecoveryMethodList]
        - [DS: ListItem] Password reset
        - [DS: ListItem] Backup MFA
        - [DS: ListItem] Contact support
      - [DS: RecoveryPanel]
        - [DS: AlertBanner]
        - [DS: TextField] Email or token
        - [DS: TextField] Backup code
        - [DS: ButtonGroup] Submit / Resend / Return
        - [DS: SupportCard]
- Data sources required from backend: Recovery policy, token status, email delivery status, support contact metadata.
- User actions: Request reset, validate backup code, resend recovery email, open support flow, return to login.
- Loading states: Token validation skeleton, submit spinner, resend pending state.
- Empty states: Initial recovery chooser with no active token.
- Error states: Expired token, invalid backup code, throttled resend, unavailable support route.

### SCR-002 — Context Switcher

- Purpose: Change active tenant and app scope.
- Layout Structure:
  - Navbar
    - Inherits current page navbar
  - Sidebar
    - Inherits current page sidebar
  - Content Area
    - [DS: Sheet]
      - [DS: SheetHeader]
        - [DS: Title]
        - [DS: ScopeSummary]
      - [DS: SearchField]
      - [DS: SplitPanel]
        - [DS: SelectList] Tenants
        - [DS: SelectList] Apps
      - [DS: PermissionSummary]
      - [DS: SheetFooter]
        - [DS: Button] Cancel
        - [DS: Button] Switch scope
- Data sources required from backend: Accessible tenants, accessible apps, last-used scope, scope permissions.
- User actions: Search, select tenant, select app, confirm switch, reset scope.
- Loading states: Tenant list skeleton, app list refresh loader, route transition loader.
- Empty states: No alternate scopes or no apps in selected tenant.
- Error states: Unauthorized scope, archived app target, scope fetch failure.

### SCR-018 — Assistant Copilot

- Purpose: Provide persistent operator assistance and scoped actions.
- Layout Structure:
  - Navbar
    - Inherits current page navbar
  - Sidebar
    - Inherits current page sidebar
  - Content Area
    - [DS: Drawer]
      - [DS: DrawerHeader]
        - [DS: Title]
        - [DS: ScopeBadge]
        - [DS: ConversationMeta]
      - [DS: ConversationFeed]
        - [DS: MessageBubble]
        - [DS: ToolActivityCard]
      - [DS: SuggestionChipRow]
      - [DS: Composer]
        - [DS: TextArea]
        - [DS: Button] Send
- Data sources required from backend: Chat history, memory context, prompt suggestions, tool availability, streaming response state.
- User actions: Ask, refine, trigger action, open linked screen, clear thread.
- Loading states: Conversation history skeleton, streaming response, tool-call progress state.
- Empty states: Starter prompt suggestions and recent tasks.
- Error states: Assistant unavailable, timed-out response, denied tool action, stale scope.

### SCR-023 — Global Loading State

- Purpose: Show structured loading during route and section transitions.
- Layout Structure:
  - Navbar
    - [DS: SkeletonBreadcrumbs]
    - [DS: SkeletonTopbarActions]
  - Sidebar
    - [DS: SkeletonScopeSummary]
    - [DS: SkeletonNavList]
  - Content Area
    - [DS: SkeletonPageHeader]
    - [DS: SkeletonBlocks]
      - [DS: SkeletonCards]
      - [DS: SkeletonTable]
      - [DS: SkeletonPanels]
- Data sources required from backend: Route loading state only.
- User actions: Wait, optionally cancel or go back when safe.
- Loading states: Short-load, long-load, and escalation variants.
- Empty states: Not applicable.
- Error states: Escalation into error recovery when load fails.

### SCR-024 — Global Error Recovery

- Purpose: Recover from route, session, or service failures.
- Layout Structure:
  - Navbar
    - [DS: BrandBar]
  - Sidebar
    - None
  - Content Area
    - [DS: CenteredState]
      - [DS: ErrorIllustration]
      - [DS: ErrorTitle]
      - [DS: ErrorDescription]
      - [DS: ContextSummary]
      - [DS: ButtonGroup] Retry / Sign in / Status page
      - [DS: SupportLinks]
- Data sources required from backend: Error category, route context, correlation ID, service status summary.
- User actions: Retry, sign in again, open status/help, return to safe route.
- Loading states: Retry pending, re-auth redirect.
- Empty states: Not applicable.
- Error states: Repeated failure, missing fallback route, recovery service unavailable.

### SCR-025 — Toast Notifications

- Purpose: Surface non-blocking success, warning, and error feedback.
- Layout Structure:
  - Navbar
    - Inherits current page navbar
  - Sidebar
    - Inherits current page sidebar
  - Content Area
    - [DS: ToastRegion]
      - [DS: ToastItem]
        - [DS: StatusIcon]
        - [DS: MessageText]
        - [DS: InlineAction]
        - [DS: DismissButton]
- Data sources required from backend: Mutation outcome payload, severity, optional linked destination or correlation ID.
- User actions: Read, dismiss, open linked record, undo when available.
- Loading states: Pending toast and resolution toast variants.
- Empty states: No active toasts.
- Error states: Critical failure escalates to persistent banner if toast cannot render.

### SCR-030 — Access Denied / Request Access

- Purpose: Explain why a route or action is unavailable and offer safe alternatives.
- Layout Structure:
  - Navbar
    - [DS: BrandBar]
    - [DS: UserMenu]
  - Sidebar
    - Optional simplified nav of allowed destinations
  - Content Area
    - [DS: CenteredState]
      - [DS: LockIllustration]
      - [DS: PermissionSummary]
      - [DS: ScopeSummary]
      - [DS: LinkList] Suggested destinations
      - [DS: InlineForm] Request access
      - [DS: Button] Return
- Data sources required from backend: Required permission, current roles, scope, access-request configuration.
- User actions: Navigate away, request access, copy route, change scope.
- Loading states: Request submission pending, redirect loading.
- Empty states: Not applicable.
- Error states: Request service unavailable, permission metadata missing, stale denied route.

## Dashboard

### SCR-003 — Platform Overview

- Purpose: Deliver platform-wide triage through KPIs, alerts, health, and activity summaries.
- Layout Structure:
  - Navbar
    - [DS: Breadcrumbs]
    - [DS: SearchCommand]
    - [DS: ScopeChip]
    - [DS: AlertBell]
    - [DS: AssistantTrigger]
  - Sidebar
    - [DS: ModuleNav]
  - Content Area
    - [DS: PageHeader]
    - [DS: KPIGrid]
      - [DS: KPICard]
    - [DS: SplitPanel]
      - [DS: AlertRail]
      - [DS: ServiceHealthPanel]
    - [DS: SplitPanel]
      - [DS: ModelStatusPanel]
      - [DS: RecentActivityList]
- Data sources required from backend: KPI summaries, alerts, service snapshot, model posture, recent events.
- User actions: Drill into incidents, open alerts, navigate to events/observability/models/audit, refresh.
- Loading states: KPI skeletons, section-level shimmers, partial refresh indicators.
- Empty states: No active incidents or limited scoped activity.
- Error states: Section fetch failures, stale snapshot warning, missing scoped data.

### SCR-031 — Alerts Inbox

- Purpose: Manage alerts, ownership, and navigation into investigation flows.
- Layout Structure:
  - Navbar
    - [DS: Breadcrumbs]
    - [DS: ScopeChip]
    - [DS: AssistantTrigger]
  - Sidebar
    - [DS: ModuleNav]
  - Content Area
    - [DS: PageHeader] or [DS: DrawerHeader] on desktop overlay mode
    - [DS: FilterBar]
      - [DS: SearchField]
      - [DS: FilterChips] Severity / Status / Owner
    - [DS: SplitPanel]
      - [DS: ListPanel] Alert list
      - [DS: DetailPanel] Alert preview
    - [DS: ActionBar]
      - [DS: Button] Acknowledge
      - [DS: Button] Assign
      - [DS: Button] Open incident
- Data sources required from backend: Alert feed, severity/status metadata, ownership, linked incident references.
- User actions: Filter, acknowledge, assign, snooze, open incident, mark resolved.
- Loading states: List skeleton, preview shimmer, pagination loader.
- Empty states: No active alerts or no alerts for current filter.
- Error states: Feed unavailable, ownership conflict, linked incident missing.

### SCR-013 — Events Monitor

- Purpose: Present a live event stream for real-time operational triage.
- Layout Structure:
  - Navbar
    - [DS: Breadcrumbs]
    - [DS: ScopeChip]
    - [DS: AlertBell]
    - [DS: AssistantTrigger]
  - Sidebar
    - [DS: ModuleNav]
  - Content Area
    - [DS: PageHeader]
    - [DS: ControlBar]
      - [DS: Toggle] Pause / Resume
      - [DS: StreamStatus]
      - [DS: FilterBar]
    - [DS: SplitPanel]
      - [DS: EventTable]
      - [DS: InspectorPanel]
    - [DS: FooterBar]
      - [DS: ExportButton]
      - [DS: SavedViewButton]
- Data sources required from backend: Event stream, filter options, selected event payload, stream health.
- User actions: Pause/resume, filter, inspect event, open related incident/agent/audit entry.
- Loading states: Initial stream skeleton, reconnect state, filter refresh.
- Empty states: No events in current range or scope.
- Error states: Stream disconnect, replay unavailable, malformed event payload.

### SCR-014 — Analytics

- Purpose: Show trend and performance analysis rather than live operations.
- Layout Structure:
  - Navbar
    - [DS: Breadcrumbs]
    - [DS: ScopeChip]
    - [DS: ExportButton]
  - Sidebar
    - [DS: ModuleNav]
  - Content Area
    - [DS: PageHeader]
    - [DS: FilterBar]
      - [DS: DateRangePicker]
      - [DS: SegmentSelector]
    - [DS: KPIGrid]
    - [DS: ChartGrid]
      - [DS: LineChart]
      - [DS: BarChart]
      - [DS: ComparisonChart]
    - [DS: InsightsPanel]
- Data sources required from backend: KPI rollups, trend series, segmentation dimensions, comparison baselines.
- User actions: Change date range, segment, compare, export, open related insight screens.
- Loading states: Chart skeletons, metric shimmers, comparison recalculation state.
- Empty states: No available history or no matching data in range.
- Error states: Aggregation timeout, partial series error, unsupported segment combination.

### SCR-015 — Observability

- Purpose: Support service-level investigation with metrics, client errors, and external tool pivots.
- Layout Structure:
  - Navbar
    - [DS: Breadcrumbs]
    - [DS: ScopeChip]
    - [DS: AlertBell]
  - Sidebar
    - [DS: ModuleNav]
  - Content Area
    - [DS: PageHeader]
    - [DS: HealthSummaryRow]
    - [DS: Tabs]
      - [DS: TabPanel] Metrics
        - [DS: ChartGrid]
      - [DS: TabPanel] Client Errors
        - [DS: ErrorList]
      - [DS: TabPanel] External Tools
        - [DS: LinkCardGrid]
    - [DS: SidePanel] Incident pivots
- Data sources required from backend: Service health, live charts, client errors, tool links, alert correlations.
- User actions: Switch service view, inspect errors, open external tooling, pivot to incident or audit.
- Loading states: Widget skeletons, reconnect banner, tab-level loading.
- Empty states: No incidents, no recent errors, or no metrics for selected service.
- Error states: Metrics backend failure, embed unavailable, incomplete client error data.

### SCR-027 — Incident Detail Workspace

- Purpose: Correlate all evidence for one incident in a single workspace.
- Layout Structure:
  - Navbar
    - [DS: Breadcrumbs]
    - [DS: BackButton]
    - [DS: ScopeChip]
    - [DS: AssistantTrigger]
  - Sidebar
    - [DS: ModuleNav]
  - Content Area
    - [DS: DetailHeader]
      - [DS: StatusBadge]
      - [DS: OwnerBadge]
      - [DS: ActionButtons]
    - [DS: SplitPanel]
      - [DS: TimelinePanel]
      - [DS: SummarySidebar]
    - [DS: Tabs]
      - [DS: TabPanel] Alerts
      - [DS: TabPanel] Events
      - [DS: TabPanel] Observability
      - [DS: TabPanel] Audit
      - [DS: TabPanel] Recommendations
- Data sources required from backend: Incident metadata, timeline events, related alerts, observability evidence, audit evidence, recommendations.
- User actions: Change status, assign owner, add note, export summary, open linked evidence, launch recommendation review.
- Loading states: Timeline skeleton, tab placeholders, evidence enrichment loader.
- Empty states: Incident exists but no correlated evidence yet.
- Error states: Incident not found, evidence source unavailable, stale linked resource.

## Content Interaction

### SCR-011 — AI Memory

- Purpose: Inspect memory growth, retention, and compaction posture.
- Layout Structure:
  - Navbar
    - [DS: Breadcrumbs]
    - [DS: ScopeChip]
  - Sidebar
    - [DS: ModuleNav]
  - Content Area
    - [DS: PageHeader]
    - [DS: KPIGrid]
    - [DS: FilterBar]
      - [DS: ScopeFilter]
    - [DS: SplitPanel]
      - [DS: DataTable] Memory scopes
      - [DS: DetailPanel] Selected scope
    - [DS: HistoryPanel] Compaction / retention
- Data sources required from backend: Memory scopes, record counts, vector counts, compaction history, retention rules.
- User actions: Filter scope, inspect segment, compare memory density, open linked research outputs.
- Loading states: KPI shimmer, table skeleton, detail-panel loader.
- Empty states: No memory data for selected scope.
- Error states: Metrics unavailable, stale scope, history fetch failure.

### SCR-012 — Knowledge Graph Explorer

- Purpose: Explore entity relationships and supporting graph context.
- Layout Structure:
  - Navbar
    - [DS: Breadcrumbs]
    - [DS: ScopeChip]
  - Sidebar
    - [DS: ModuleNav]
  - Content Area
    - [DS: PageHeader]
    - [DS: ThreePanelLayout]
      - [DS: FilterPanel]
        - [DS: SearchField]
        - [DS: FilterChips]
        - [DS: SavedViewList]
      - [DS: GraphCanvas]
        - [DS: ZoomControls]
        - [DS: Legend]
      - [DS: InspectorPanel]
        - [DS: EntitySummary]
        - [DS: RelationshipList]
    - [DS: TogglePanel] Table fallback
- Data sources required from backend: Graph nodes, edges, saved views, selected-node details, path results.
- User actions: Search, expand path, filter graph, save view, switch to table mode, open related recommendation.
- Loading states: Canvas loader, node expansion spinner, inspector skeleton.
- Empty states: No matching graph results or no relationships in scope.
- Error states: Query timeout, oversized graph result, corrupted saved view.

### SCR-019 — Research Operations

- Purpose: Launch and manage research runs, schedules, and triggers.
- Layout Structure:
  - Navbar
    - [DS: Breadcrumbs]
    - [DS: ScopeChip]
    - [DS: AssistantTrigger]
  - Sidebar
    - [DS: ModuleNav]
  - Content Area
    - [DS: PageHeader]
      - [DS: Button] Launch run
    - [DS: KPIGrid] Run counts
    - [DS: SplitPanel]
      - [DS: SchedulePanel]
      - [DS: TriggerPanel]
    - [DS: DataTable] Research runs
    - [DS: PreviewRail] Artifact preview
- Data sources required from backend: Research runs, schedules, triggers, status counts, artifact previews.
- User actions: Launch run, edit schedule, filter runs, open run detail, inspect downstream outputs.
- Loading states: Table skeleton, schedule shimmer, launch pending state.
- Empty states: No runs created yet or no runs match current filters.
- Error states: Launch failure, invalid schedule, stale trigger configuration.

### SCR-028 — Research Run Detail

- Purpose: Inspect one research run end to end.
- Layout Structure:
  - Navbar
    - [DS: Breadcrumbs]
    - [DS: BackButton]
    - [DS: ScopeChip]
  - Sidebar
    - [DS: ModuleNav]
  - Content Area
    - [DS: DetailHeader]
      - [DS: StatusBadge]
      - [DS: MetaBadges]
      - [DS: ActionButtons]
    - [DS: SplitPanel]
      - [DS: ArtifactList]
      - [DS: DiagnosticsPanel]
    - [DS: Tabs]
      - [DS: TabPanel] Source metadata
      - [DS: TabPanel] Embeddings
      - [DS: TabPanel] Lineage
      - [DS: TabPanel] Downstream links
- Data sources required from backend: Run metadata, artifacts, diagnostics, source documents, embedding counts, lineage, linked outputs.
- User actions: Inspect artifact, retry/relaunch if allowed, copy run link, open signals or recommendation detail.
- Loading states: Artifact skeleton, diagnostic loader, lineage shimmer.
- Empty states: Completed run with no artifacts or quarantined output.
- Error states: Run missing, artifact fetch failure, lineage unavailable.

### SCR-020 — Market Signals & Insights

- Purpose: Review generated signals, trends, and confidence-rated insights.
- Layout Structure:
  - Navbar
    - [DS: Breadcrumbs]
    - [DS: ScopeChip]
  - Sidebar
    - [DS: ModuleNav]
  - Content Area
    - [DS: PageHeader]
    - [DS: FilterBar]
      - [DS: DateRangePicker]
      - [DS: SegmentSelector]
      - [DS: ConfidenceFilter]
    - [DS: SummaryRow]
      - [DS: TrendCard]
      - [DS: SignalCard]
    - [DS: SplitPanel]
      - [DS: InsightList]
      - [DS: RationalePanel]
- Data sources required from backend: Signal summaries, confidence scores, trends, segmentation metadata, lineage summary.
- User actions: Filter, segment, inspect rationale, open graph context, send to recommendations.
- Loading states: Summary-card skeletons, rationale shimmer, filtered refresh state.
- Empty states: No signals in selected range or scope.
- Error states: Confidence service failure, stale lineage, segmentation error.

### SCR-021 — Recommendations Workbench

- Purpose: Prioritize and act on recommendations.
- Layout Structure:
  - Navbar
    - [DS: Breadcrumbs]
    - [DS: ScopeChip]
    - [DS: AssistantTrigger]
  - Sidebar
    - [DS: ModuleNav]
  - Content Area
    - [DS: PageHeader]
    - [DS: FilterBar]
      - [DS: SearchField]
      - [DS: PriorityFilter]
      - [DS: StatusFilter]
      - [DS: ConfidenceFilter]
    - [DS: SplitPanel]
      - [DS: RecommendationList]
      - [DS: PreviewPanel]
    - [DS: ActionBar]
      - [DS: Button] Open detail
      - [DS: Button] Approve / Defer / Reject
      - [DS: Button] Capture outcome
- Data sources required from backend: Recommendation list, priority/confidence/state metadata, linked incidents/workflows, rationale summary.
- User actions: Filter, preview, open detail, approve/defer/reject, launch outcome capture.
- Loading states: List skeleton, preview shimmer, action pending state.
- Empty states: No recommendations or no recommendations matching filters.
- Error states: Fetch failure, stale recommendation status, permission denied for action.

### SCR-029 — Recommendation Detail

- Purpose: Review full recommendation evidence and approval context.
- Layout Structure:
  - Navbar
    - [DS: Breadcrumbs]
    - [DS: BackButton]
    - [DS: ScopeChip]
  - Sidebar
    - [DS: ModuleNav]
  - Content Area
    - [DS: DetailHeader]
      - [DS: ConfidenceBadge]
      - [DS: StatusBadge]
      - [DS: ActionButtons]
    - [DS: SplitPanel]
      - [DS: NarrativePanel]
      - [DS: ImpactPanel]
    - [DS: Tabs]
      - [DS: TabPanel] Supporting signals
      - [DS: TabPanel] Research lineage
      - [DS: TabPanel] Graph context
      - [DS: TabPanel] Approval history
    - [DS: FooterBar]
      - [DS: Button] Capture outcome
- Data sources required from backend: Recommendation metadata, evidence, impacted entities, approval history, prior outcomes.
- User actions: Approve, reject, defer, assign owner, open source evidence, capture outcome.
- Loading states: Detail skeleton, tab shimmer, approval-history loader.
- Empty states: Recommendation exists but enrichment is incomplete.
- Error states: Recommendation missing, invalid transition, broken evidence links.

### SCR-022 — Outcome Feedback Capture

- Purpose: Record the outcome of a recommendation, workflow, or agent action.
- Layout Structure:
  - Navbar
    - Inherits source page navbar
  - Sidebar
    - Inherits source page sidebar
  - Content Area
    - [DS: Modal]
      - [DS: ModalHeader]
      - [DS: SummaryPanel] Source context
      - [DS: FormSection]
        - [DS: Select] Outcome status
        - [DS: CheckboxGroup] Impact tags
        - [DS: TextArea] Notes
      - [DS: AuditNotice]
      - [DS: ModalFooter]
        - [DS: Button] Cancel
        - [DS: Button] Submit outcome
- Data sources required from backend: Source context, allowed statuses, prior outcomes, user identity.
- User actions: Select status, add notes, submit, reopen source record.
- Loading states: Source summary skeleton, submit spinner.
- Empty states: Should not render without source context.
- Error states: Validation failure, duplicate submission, source record no longer available.

## Administration

### SCR-004 — Tenants

- Purpose: Manage tenant lifecycle and governance posture.
- Layout Structure:
  - Navbar
    - [DS: Breadcrumbs]
    - [DS: ScopeChip]
  - Sidebar
    - [DS: ModuleNav]
  - Content Area
    - [DS: PageHeader]
      - [DS: Button] Create tenant
    - [DS: KPIGrid]
    - [DS: FilterBar]
      - [DS: SearchField]
      - [DS: Select] Tier
      - [DS: Select] Region
      - [DS: Select] Health
    - [DS: DataTable] Tenant fleet
    - [DS: Drawer] Tenant detail/edit
- Data sources required from backend: Tenant list, quotas, spend, region, health, pagination, filter metadata.
- User actions: Filter, inspect, create, edit, open apps, open audit.
- Loading states: Table skeleton, drawer shimmer, row-save indicator.
- Empty states: No tenants exist or no tenants match filters.
- Error states: Save validation failure, concurrency conflict, permission denied.

### SCR-005 — Apps

- Purpose: Manage application registry by tenant and environment.
- Layout Structure:
  - Navbar
    - [DS: Breadcrumbs]
    - [DS: ScopeChip]
  - Sidebar
    - [DS: ModuleNav]
  - Content Area
    - [DS: PageHeader]
      - [DS: Button] Create app
    - [DS: ScopeBanner]
    - [DS: KPIGrid]
    - [DS: FilterBar]
      - [DS: SearchField]
      - [DS: Select] Environment
      - [DS: Select] Runtime
      - [DS: Select] Status
    - [DS: DataTable] App registry
    - [DS: Drawer] App detail/edit
- Data sources required from backend: App list, environment/runtime metadata, deployment status, tenant relationships.
- User actions: Filter, inspect app, create/edit app, open related users or audit.
- Loading states: Table skeleton, scope-change refresh, save state.
- Empty states: No apps in tenant or no apps match current filters.
- Error states: Scope mismatch, archived app conflict, create/update validation error.

### SCR-006 — Users

- Purpose: Administer user access, roles, and status.
- Layout Structure:
  - Navbar
    - [DS: Breadcrumbs]
    - [DS: ScopeChip]
  - Sidebar
    - [DS: ModuleNav]
  - Content Area
    - [DS: PageHeader]
      - [DS: Button] Add user
    - [DS: KPIGrid]
    - [DS: FilterBar]
      - [DS: SearchField]
      - [DS: Select] Role
      - [DS: Select] Status
    - [DS: DataTable] User directory
    - [DS: Drawer] User detail/edit
- Data sources required from backend: Directory, role assignments, statuses, membership, recent activity.
- User actions: Search, filter, add user, edit role/status, inspect activity, open audit.
- Loading states: Directory skeleton, row update state, activity panel loader.
- Empty states: No users in scope or no filter matches.
- Error states: Invite failure, role update denied, stale membership state.

### SCR-007 — Agents Operations Console

- Purpose: Monitor the fleet and operate individual agents through progressive detail.
- Layout Structure:
  - Navbar
    - [DS: Breadcrumbs]
    - [DS: ScopeChip]
    - [DS: AssistantTrigger]
  - Sidebar
    - [DS: ModuleNav]
  - Content Area
    - [DS: PageHeader]
    - [DS: KPIGrid]
    - [DS: FilterBar]
      - [DS: SearchField]
      - [DS: StateFilter]
      - [DS: WorkflowFilter]
    - [DS: SplitPanel]
      - [DS: CardList] Fleet overview
      - [DS: Tabs] Selected agent detail
        - [DS: TabPanel] Overview
        - [DS: TabPanel] Logs
        - [DS: TabPanel] Tasks
        - [DS: TabPanel] Decisions
    - [DS: ActionDrawer] Advanced operations
- Data sources required from backend: Agents, logs, tasks, decisions, budgets, workflow version, performance.
- User actions: Filter, inspect agent, pause/restart/reroute, move stage, adjust budget, open workflow/outcome capture.
- Loading states: Fleet card skeletons, detail-tabs shimmer, action pending state, log reconnect.
- Empty states: No agents in scope or no agents match state.
- Error states: Action denied, stale agent state, logs unavailable, workflow mismatch.

### SCR-008 — Workflow Orchestrator

- Purpose: Manage multi-agent workflows, schedules, and lifecycle state.
- Layout Structure:
  - Navbar
    - [DS: Breadcrumbs]
    - [DS: ScopeChip]
  - Sidebar
    - [DS: ModuleNav]
  - Content Area
    - [DS: PageHeader]
      - [DS: Button] Schedule workflow
    - [DS: KPIGrid]
    - [DS: SplitPanel]
      - [DS: DataTable] Workflow list
      - [DS: TimelinePanel] Selected workflow
    - [DS: SidePanel]
      - [DS: ParticipantList]
      - [DS: SummaryCard]
      - [DS: ActionButtons]
- Data sources required from backend: Workflows, participant agents, schedule data, lifecycle state, aggregate outcomes.
- User actions: Schedule, inspect participants, update lifecycle, open outcome capture, pivot to audit or agents.
- Loading states: Workflow table skeleton, timeline shimmer, schedule pending state.
- Empty states: No workflows defined or no workflows match current state.
- Error states: Scheduling failure, lifecycle conflict, participant data error.

### SCR-009 — Tool Registry

- Purpose: Review tool contracts, permissions, and usage risk.
- Layout Structure:
  - Navbar
    - [DS: Breadcrumbs]
    - [DS: ScopeChip]
  - Sidebar
    - [DS: ModuleNav]
  - Content Area
    - [DS: PageHeader]
    - [DS: KPIGrid] Risk summary
    - [DS: FilterBar]
      - [DS: SearchField]
      - [DS: Select] Risk level
      - [DS: Select] Permission level
    - [DS: DataTable] Tool registry
    - [DS: Drawer] Schema and telemetry detail
- Data sources required from backend: Tool metadata, schemas, permissions, risk posture, usage telemetry.
- User actions: Filter, inspect schema, review risk, open audit evidence.
- Loading states: Table skeleton, telemetry loader, detail-panel shimmer.
- Empty states: No tools registered or no tool matches current risk filter.
- Error states: Schema unavailable, telemetry fetch failure, permission metadata mismatch.

### SCR-010 — AI Models Routing

- Purpose: Compare and switch active or fallback models.
- Layout Structure:
  - Navbar
    - [DS: Breadcrumbs]
    - [DS: ScopeChip]
    - [DS: AlertBell]
  - Sidebar
    - [DS: ModuleNav]
  - Content Area
    - [DS: PageHeader]
    - [DS: SplitPanel]
      - [DS: CardStack] Active / fallback summaries
      - [DS: ChartPanel] Latency / error / token trends
    - [DS: DataTable] Candidate models
    - [DS: ReviewPanel]
      - [DS: DiffSummary]
      - [DS: Button] Switch model
      - [DS: AuditNotice]
- Data sources required from backend: Model registry, mappings, performance metrics, switch history, candidate availability.
- User actions: Compare candidates, inspect metrics, switch model, review fallback posture, open audit.
- Loading states: Card skeletons, trend shimmer, switch pending state.
- Empty states: No eligible candidates or no data for selected family.
- Error states: Switch blocked, stale model metadata, metrics unavailable.

### SCR-016 — Audit Log

- Purpose: Search, review, and export compliance history.
- Layout Structure:
  - Navbar
    - [DS: Breadcrumbs]
    - [DS: ScopeChip]
  - Sidebar
    - [DS: ModuleNav]
  - Content Area
    - [DS: PageHeader]
      - [DS: Button] Export
    - [DS: FilterBar]
      - [DS: SearchField]
      - [DS: Select] Actor
      - [DS: Select] Action
      - [DS: Select] Resource
      - [DS: DateRangePicker]
    - [DS: SplitPanel]
      - [DS: DataTable] Audit rows
      - [DS: DetailPanel] Selected entry
- Data sources required from backend: Audit rows, filter metadata, export state, related resource links.
- User actions: Filter, inspect row, export, open related tenant/user/model/workflow/incident.
- Loading states: Table skeleton, export progress, detail-panel shimmer.
- Empty states: No audit entries in selected range or scope.
- Error states: Export failure, query timeout, linked resource missing.

## Settings

### SCR-017 — System Settings

- Purpose: Manage global configuration using a governed draft-and-review flow.
- Layout Structure:
  - Navbar
    - [DS: Breadcrumbs]
    - [DS: ScopeChip]
  - Sidebar
    - [DS: ModuleNav]
  - Content Area
    - [DS: PageHeader]
    - [DS: Tabs] Settings categories
    - [DS: SplitPanel]
      - [DS: FormPanel] Editable settings
      - [DS: ReviewPanel]
        - [DS: DiffSummary]
        - [DS: ApprovalChecklist]
        - [DS: AuditSummary]
    - [DS: FooterBar]
      - [DS: Button] Discard draft
      - [DS: Button] Publish changes
- Data sources required from backend: Settings sections, validation metadata, draft state, change history, approval rules.
- User actions: Edit drafts, compare changes, publish, discard, open audit history.
- Loading states: Section skeletons, diff loader, publish pending state.
- Empty states: No configurable items in category or no draft changes.
- Error states: Validation failure, conflicting draft version, publish denied.