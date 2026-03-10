import { hasPermission } from '@/lib/rbac';
import { createAssistantMessage } from '@/lib/assistant';
import { controlPlaneService } from '@/services/control-plane';
import type {
  AgentRecord,
  AnalyticsBundle,
  AssistantChatMessage,
  AssistantToolCall,
  AssistantToolName,
  GraphEdgeRecord,
  GraphNodeRecord,
  MemoryContext,
  MemoryRecord,
  ModelRecord,
  Permission,
  PlatformEvent,
  PlatformOverview,
  ServiceHealth,
  SessionUser,
} from '@/types/platform';

type AssistantIntent =
  | 'overview'
  | 'analytics'
  | 'throttled_agents'
  | 'supply_gaps'
  | 'observability'
  | 'events'
  | 'memory'
  | 'models'
  | 'navigate';

const NAVIGATION_MAP: Record<string, { path: string; label: string }> = {
  overview: { path: '/', label: 'Overview' },
  home: { path: '/', label: 'Overview' },
  dashboard: { path: '/', label: 'Overview' },
  agents: { path: '/agents', label: 'Agents' },
  analytics: { path: '/analytics', label: 'Analytics' },
  apps: { path: '/apps', label: 'Apps' },
  applications: { path: '/apps', label: 'Apps' },
  audit: { path: '/audit', label: 'Audit Logs' },
  events: { path: '/events', label: 'Events' },
  'knowledge graph': { path: '/knowledge-graph', label: 'Knowledge Graph' },
  knowledge: { path: '/knowledge-graph', label: 'Knowledge Graph' },
  graph: { path: '/knowledge-graph', label: 'Knowledge Graph' },
  memory: { path: '/memory', label: 'Memory' },
  models: { path: '/models', label: 'Models' },
  observability: { path: '/observability', label: 'Observability' },
  health: { path: '/observability', label: 'Observability' },
  recommendations: { path: '/recommendations', label: 'Recommendations' },
  research: { path: '/research', label: 'Research' },
  settings: { path: '/settings', label: 'Settings' },
  signals: { path: '/signals', label: 'Market Signals' },
  'market signals': { path: '/signals', label: 'Market Signals' },
  tenants: { path: '/tenants', label: 'Tenants' },
  tools: { path: '/tools', label: 'Tools' },
  users: { path: '/users', label: 'Users' },
  workflows: { path: '/workflows', label: 'Workflows' },
  alerts: { path: '/alerts', label: 'Alerts' },
  incidents: { path: '/incidents', label: 'Incidents' },
};

function resolveNavigationTarget(message: string): { path: string; label: string } | null {
  const normalized = message.toLowerCase().replace(/^(open|go to|navigate to|take me to|show me)\s+/i, '').replace(/\s+page$/i, '').trim();
  if (NAVIGATION_MAP[normalized]) return NAVIGATION_MAP[normalized];
  for (const [keyword, target] of Object.entries(NAVIGATION_MAP)) {
    if (normalized.includes(keyword)) return target;
  }
  return null;
}

type ToolExecution<T> = {
  toolCall: AssistantToolCall;
  data?: T;
};

type AssistantReply = {
  message: AssistantChatMessage;
  suggestions: string[];
};

const toolPermissions: Record<AssistantToolName, Permission> = {
  'control.read.overview': 'analytics:read',
  'control.read.analytics': 'analytics:read',
  'control.read.agents': 'agents:read',
  'control.read.tools': 'tools:read',
  'control.read.knowledge-graph': 'graph:read',
  'control.read.events': 'events:read',
  'control.read.observability': 'observability:read',
  'control.read.memory': 'memory:read',
  'control.read.models': 'models:read',
  'control.read.market-signals': 'analytics:read',
  'control.read.recommendations': 'analytics:read',
  'control.read.agent-performance': 'analytics:read',
  'control.run.research-agent': 'agents:operate',
  'control.run.insight-agent': 'agents:operate',
  'control.run.recommendation-agent': 'agents:operate',
  'control.write.feedback': 'agents:operate',
  'assistant.navigate': 'analytics:read',
};

function planIntent(message: string, history: AssistantChatMessage[], pathname?: string): AssistantIntent {
  const normalized = message.toLowerCase();
  if (/^(open|go to|navigate to|take me to|show me)\b/.test(normalized)) return 'navigate';
  if (/supply|demand|gap|market imbalance/.test(normalized)) return 'supply_gaps';
  if (/throttled|queue|backlog|agent/.test(normalized)) return 'throttled_agents';
  if (/observability|service|health|cpu|memory|restart|error|hotspot/.test(normalized)) return 'observability';
  if (/event|activity|trigger/.test(normalized)) return 'events';
  if (/memory|vector|context store/.test(normalized)) return 'memory';
  if (/model|provider|planner|embedding/.test(normalized)) return 'models';
  if (/analytics|kpi|growth/.test(normalized)) return 'analytics';

  if (/those|them|their|what about that/.test(normalized)) {
    const lastTool = [...history]
      .reverse()
      .flatMap((item) => [...item.toolCalls].reverse())
      .find((call) => call.status === 'completed')?.tool;
    if (lastTool === 'control.read.agents') return 'throttled_agents';
    if (lastTool === 'control.read.knowledge-graph') return 'supply_gaps';
    if (lastTool === 'control.read.observability') return 'observability';
    if (lastTool === 'control.read.events') return 'events';
  }

  if (pathname?.startsWith('/agents')) return 'throttled_agents';
  if (pathname?.startsWith('/knowledge-graph')) return 'supply_gaps';
  if (pathname?.startsWith('/observability')) return 'observability';
  if (pathname?.startsWith('/events')) return 'events';
  if (pathname?.startsWith('/memory')) return 'memory';
  if (pathname?.startsWith('/models')) return 'models';
  if (pathname?.startsWith('/analytics')) return 'analytics';
  return 'overview';
}

function blockedReply(permission: Permission) {
  return `I can’t inspect that data in this session because it requires the \`${permission}\` permission.`;
}

async function runTool<T>(
  sessionUser: SessionUser,
  tool: AssistantToolName,
  action: () => Promise<T>,
  summarize: (payload: T) => string,
): Promise<ToolExecution<T>> {
  const permission = toolPermissions[tool];
  if (!hasPermission(sessionUser.roles, permission)) {
    return {
      toolCall: {
        tool,
        permission,
        status: 'blocked',
        summary: blockedReply(permission),
      },
    };
  }

  try {
    const data = await action();
    return {
      data,
      toolCall: {
        tool,
        permission,
        status: 'completed',
        summary: summarize(data),
      },
    };
  } catch (error) {
    return {
      toolCall: {
        tool,
        permission,
        status: 'failed',
        summary:
          error instanceof Error ? error.message : 'The assistant could not read that control-plane surface.',
      },
    };
  }
}

function completedToolCount(toolCalls: AssistantToolCall[]) {
  return toolCalls.filter((call) => call.status === 'completed').length;
}

function buildOverviewContent(result: ToolExecution<PlatformOverview>) {
  if (!result.data) return result.toolCall.summary;
  const topAlert = result.data.alerts[0];
  return [
    `Current overview: ${result.data.runningAgents} running agents, queue backlog ${result.data.queueBacklog}, and ${result.data.liveEventsPerMinute} live events/minute.`,
    topAlert ? `Top alert: ${topAlert.title} — ${topAlert.summary}` : 'No active top-level alerts are flagged right now.',
  ].join('\n');
}

function buildAnalyticsContent(result: ToolExecution<AnalyticsBundle>) {
  if (!result.data) return result.toolCall.summary;
  const leadKpis = result.data.kpis.slice(0, 3).map((item) => `${item.label}: ${item.value} (${item.change})`);
  return `Analytics snapshot:\n• ${leadKpis.join('\n• ')}`;
}

function buildThrottledAgentsContent(result: ToolExecution<{ items: AgentRecord[] }>) {
  if (!result.data) return result.toolCall.summary;
  const throttled = result.data.items.filter((agent) => agent.state === 'throttled');
  if (!throttled.length) {
    return 'I don’t see any throttled agents in the current tenant/app scope.';
  }

  return [
    `I found ${throttled.length} throttled agent${throttled.length === 1 ? '' : 's'} in the current scope:`,
    ...throttled.slice(0, 3).map(
      (agent) =>
        `• ${agent.name} — queue \`${agent.queue}\` has ${agent.queueDepth} queued items, ${agent.budgetUtilizationPercent}% budget used, ${agent.avgLatencyMs}ms avg latency. ${agent.decisions[0]?.summary ?? agent.lastTask}`,
    ),
  ].join('\n');
}

function buildSupplyGapContent(
  graphResult: ToolExecution<{ nodes: GraphNodeRecord[]; edges: GraphEdgeRecord[] }>,
  agentResult: ToolExecution<{ items: AgentRecord[] }>,
  eventResult: ToolExecution<{ items: PlatformEvent[] }>,
) {
  if (!graphResult.data) return graphResult.toolCall.summary;
  const category = graphResult.data.nodes.find((node) => node.type === 'category' && node.tags.includes('demand-surge'));
  const location = graphResult.data.nodes.find(
    (node) => node.type === 'location' && (node.tags.includes('high-demand') || node.health !== 'healthy'),
  );
  const listing = graphResult.data.nodes.find((node) => node.type === 'listing');
  const vendor = graphResult.data.nodes.find((node) => node.type === 'vendor' && node.tags.includes('supply-rich'));
  const agent = agentResult.data?.items.find((item) => /supply gap|demand/i.test(item.lastTask))
    ?? graphResult.data.nodes.find((node) => node.type === 'agent');
  const event = eventResult.data?.items.find(
    (item) => item.type === 'agent_triggered' || /demand anomaly|supply/i.test(item.summary),
  );

  const opening = category && location
    ? `The clearest supply-gap signal is around ${category.label} in ${location.label}.`
    : 'The knowledge graph shows an active demand-side imbalance in the current scope.';

  const details = [
    location
      ? `• Demand signal: ${location.label} is marked ${location.health} with context “${location.metadata}”.`
      : null,
    agent
      ? `• Monitoring: ${'lastTask' in agent ? `${agent.name} is tracking it — ${agent.lastTask}` : `${agent.label} is connected to the demand cluster.`}`
      : null,
    vendor
      ? `• Supply side: ${vendor.label} looks like the strongest supply-side entity${listing ? ` through ${listing.label}` : ''}.`
      : listing
        ? `• Supply side: ${listing.label} is the main in-scope listing attached to the demand pocket.`
        : null,
    event ? `• Recent trigger: ${event.summary}` : null,
  ].filter(Boolean);

  return [opening, ...details].join('\n');
}

function buildObservabilityContent(result: ToolExecution<{ items: ServiceHealth[] }>) {
  if (!result.data) return result.toolCall.summary;
  const unstable = result.data.items.filter((service) => service.status !== 'healthy');
  if (!unstable.length) {
    return 'All observed services are healthy in the current scope.';
  }

  return [
    `I found ${unstable.length} service hotspot${unstable.length === 1 ? '' : 's'}:`,
    ...unstable.slice(0, 3).map(
      (service) =>
        `• ${service.name} — ${service.status}, CPU ${service.cpuPercent}%, memory ${service.memoryPercent}%, restarts ${service.restarts24h}/24h.`,
    ),
  ].join('\n');
}

function buildEventsContent(result: ToolExecution<{ items: PlatformEvent[] }>) {
  if (!result.data) return result.toolCall.summary;
  return [
    'Here are the most recent scoped events:',
    ...result.data.items.slice(0, 3).map((event) => `• ${event.type} — ${event.summary}`),
  ].join('\n');
}

function buildMemoryContent(result: ToolExecution<{ items: MemoryRecord[] }>) {
  if (!result.data) return result.toolCall.summary;
  if (!result.data.items.length) return 'I don’t see any memory stores in the current scope.';
  return [
    `I found ${result.data.items.length} memory store${result.data.items.length === 1 ? '' : 's'} in scope:`,
    ...result.data.items.slice(0, 3).map(
      (item) => `• ${item.id} — ${item.records} records, ${item.vectorCount} vectors, last compaction ${item.lastCompactionAt}.`,
    ),
  ].join('\n');
}

function buildModelsContent(result: ToolExecution<{ items: ModelRecord[] }>) {
  if (!result.data) return result.toolCall.summary;
  return [
    'Current model routing:',
    ...result.data.items.slice(0, 4).map(
      (model) => `• ${model.key} → ${model.activeModel} via ${model.provider} (${model.latencyMs}ms).`,
    ),
  ].join('\n');
}

function suggestionsForIntent(intent: AssistantIntent) {
  if (intent === 'supply_gaps') return ['Which agents are throttled?', 'Show recent events', 'Summarize service health'];
  if (intent === 'throttled_agents') return ['Show recent events', 'Summarize service health', 'Show supply gaps'];
  if (intent === 'observability') return ['Which agents are throttled?', 'Show recent events', 'Give me the platform overview'];
  if (intent === 'events') return ['Which agents are throttled?', 'Show supply gaps', 'Summarize service health'];
  if (intent === 'memory') return ['What models are active?', 'Give me the platform overview', 'Show recent events'];
  if (intent === 'models') return ['Give me the platform overview', 'Show recent events', 'Which agents are throttled?'];
  if (intent === 'navigate') return suggestionsForIntent(intent);
  return ['Show supply gaps', 'Which agents are throttled?', 'Summarize service health'];
}

function withMemoryContext(content: string, memoryContext?: MemoryContext) {
  if (!memoryContext) return content;
  const lines = [] as string[];
  if (memoryContext.summary) lines.push(memoryContext.summary);
  for (const preference of memoryContext.preferences.slice(0, 2)) {
    lines.push(`Preference: ${preference.key.replaceAll('_', ' ')} → ${preference.value}.`);
  }
  for (const item of memoryContext.items.slice(0, 2)) {
    lines.push(`Relevant memory: ${item.title} — ${item.snippet}`);
  }
  if (!lines.length) return content;
  return `${content}\n\n${lines.join('\n')}`;
}

export async function getAssistantReply(input: {
  message: string;
  history: AssistantChatMessage[];
  pathname?: string;
  memoryContext?: MemoryContext;
  sessionUser: SessionUser;
}): Promise<AssistantReply> {
  const intent = planIntent(input.message, input.history, input.pathname);

  if (intent === 'navigate') {
    const target = resolveNavigationTarget(input.message);
    if (target) {
      const toolCall: AssistantToolCall = {
        tool: 'assistant.navigate',
        permission: 'analytics:read',
        status: 'completed',
        summary: `Navigating to ${target.label} (${target.path})`,
      };
      return {
        message: createAssistantMessage('assistant', `Opening **${target.label}** for you.`, [toolCall]),
        suggestions: ['Show supply gaps', 'Which agents are throttled?', 'Summarize service health'],
      };
    }
    return {
      message: createAssistantMessage('assistant', 'I couldn\'t determine which page to navigate to. Try saying "open agents", "go to analytics", or "show me workflows".'),
      suggestions: ['Open agents', 'Go to analytics', 'Show me workflows'],
    };
  }

  if (intent === 'throttled_agents') {
    const agents = await runTool(
      input.sessionUser,
      'control.read.agents',
      () => controlPlaneService.getAgents(),
      (payload) => `Inspected ${payload.items.length} agents and found ${payload.items.filter((agent) => agent.state === 'throttled').length} throttled agent(s).`,
    );
    return {
      message: createAssistantMessage('assistant', buildThrottledAgentsContent(agents), [agents.toolCall]),
      suggestions: suggestionsForIntent(intent),
    };
  }

  if (intent === 'supply_gaps') {
    const [graph, agents, events] = await Promise.all([
      runTool(
        input.sessionUser,
        'control.read.knowledge-graph',
        () => controlPlaneService.getKnowledgeGraph(),
        (payload) => `Read ${payload.nodes.length} nodes and ${payload.edges.length} relationships from the scoped graph.`,
      ),
      runTool(
        input.sessionUser,
        'control.read.agents',
        () => controlPlaneService.getAgents(),
        (payload) => `Inspected ${payload.items.length} agents for supply-side automation signals.`,
      ),
      runTool(
        input.sessionUser,
        'control.read.events',
        () => controlPlaneService.getEvents(),
        (payload) => `Reviewed ${payload.items.length} recent events for demand or trigger anomalies.`,
      ),
    ]);

    return {
      message: createAssistantMessage('assistant', withMemoryContext(buildSupplyGapContent(graph, agents, events), input.memoryContext), [graph.toolCall, agents.toolCall, events.toolCall]),
      suggestions: suggestionsForIntent(intent),
    };
  }

  if (intent === 'observability') {
    const observability = await runTool(
      input.sessionUser,
      'control.read.observability',
      () => controlPlaneService.getObservability(),
      (payload) => `Reviewed ${payload.items.length} services and found ${payload.items.filter((service) => service.status !== 'healthy').length} degraded or critical service(s).`,
    );
    return {
      message: createAssistantMessage('assistant', withMemoryContext(buildObservabilityContent(observability), input.memoryContext), [observability.toolCall]),
      suggestions: suggestionsForIntent(intent),
    };
  }

  if (intent === 'events') {
    const events = await runTool(
      input.sessionUser,
      'control.read.events',
      () => controlPlaneService.getEvents(),
      (payload) => `Reviewed ${payload.items.length} recent events.`,
    );
    return {
      message: createAssistantMessage('assistant', withMemoryContext(buildEventsContent(events), input.memoryContext), [events.toolCall]),
      suggestions: suggestionsForIntent(intent),
    };
  }

  if (intent === 'memory') {
    const memory = await runTool(
      input.sessionUser,
      'control.read.memory',
      () => controlPlaneService.getMemory(),
      (payload) => `Reviewed ${payload.items.length} scoped memory stores.`,
    );
    return {
      message: createAssistantMessage('assistant', withMemoryContext(buildMemoryContent(memory), input.memoryContext), [memory.toolCall]),
      suggestions: suggestionsForIntent(intent),
    };
  }

  if (intent === 'models') {
    const models = await runTool(
      input.sessionUser,
      'control.read.models',
      () => controlPlaneService.getModels(),
      (payload) => `Reviewed ${payload.items.length} active model routes.`,
    );
    return {
      message: createAssistantMessage('assistant', withMemoryContext(buildModelsContent(models), input.memoryContext), [models.toolCall]),
      suggestions: suggestionsForIntent(intent),
    };
  }

  if (intent === 'analytics') {
    const analytics = await runTool(
      input.sessionUser,
      'control.read.analytics',
      () => controlPlaneService.getAnalytics(),
      (payload) => `Reviewed ${payload.kpis.length} KPI tiles and ${payload.tenantGrowth.length} tenant growth points.`,
    );
    return {
      message: createAssistantMessage('assistant', withMemoryContext(buildAnalyticsContent(analytics), input.memoryContext), [analytics.toolCall]),
      suggestions: suggestionsForIntent(intent),
    };
  }

  const overview = await runTool(
    input.sessionUser,
    'control.read.overview',
    () => controlPlaneService.getOverview(),
    (payload) => `Reviewed overview metrics with ${payload.runningAgents} running agents and queue backlog ${payload.queueBacklog}.`,
  );

  const content = completedToolCount([overview.toolCall])
    ? buildOverviewContent(overview)
    : 'I’m ready to help with read-only control-plane questions like supply gaps, throttled agents, service health, events, memory, or models.';

  return {
    message: createAssistantMessage('assistant', withMemoryContext(content, input.memoryContext), [overview.toolCall]),
    suggestions: suggestionsForIntent(intent),
  };
}