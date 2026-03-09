import { hasPermission } from './authz.mjs';

const PLATFORM_TENANT_ID = 'platform-root';
const PLATFORM_APP_ID = 'control-dashboard';

const toolDefinitions = {
  'control.read.overview': { permission: 'analytics:read', load: (store, filters) => store.getOverview(filters), summarize: (payload) => `Reviewed ${payload.metrics.length} overview metrics and ${payload.alerts.length} alerts.` },
  'control.read.analytics': { permission: 'analytics:read', load: (store, filters) => store.getAnalytics(filters), summarize: (payload) => `Reviewed ${payload.kpis.length} KPIs and ${payload.toolUsageByDomain.length} tool-usage series.` },
  'control.read.agents': { permission: 'agents:read', load: (store, filters) => store.listAgents(filters), summarize: (payload) => `Reviewed ${payload.length} agents for execution pressure and backlog.` },
  'control.read.tools': { permission: 'tools:read', load: (store) => store.listTools(), summarize: (payload) => `Reviewed ${payload.length} tool contracts and risk profiles.` },
  'control.read.knowledge-graph': { permission: 'graph:read', load: (store, filters) => store.getKnowledgeGraph(filters, {}), summarize: (payload) => `Reviewed ${payload.nodes.length} graph nodes and ${payload.edges.length} relationships.` },
  'control.read.events': { permission: 'events:read', load: (store, filters) => store.listEvents(filters), summarize: (payload) => `Reviewed ${payload.length} recent events in scope.` },
  'control.read.observability': { permission: 'observability:read', load: (store, filters) => store.getObservability(filters), summarize: (payload) => `Reviewed ${payload.length} services for health, CPU, memory, and restart alerts.` },
  'control.read.memory': { permission: 'memory:read', load: (store, filters) => store.listMemory(filters), summarize: (payload) => `Reviewed ${payload.length} memory scopes and vector stores.` },
  'control.read.models': { permission: 'models:read', load: (store) => store.listModels(), summarize: (payload) => `Reviewed ${payload.length} model routes and providers.` },
  'control.read.market-signals': { permission: 'analytics:read', load: (store, filters) => store.listMarketSignals({ ...filters, limit: 6 }), summarize: (payload) => `Reviewed ${payload.length} recent market signals.` },
  'control.read.recommendations': { permission: 'analytics:read', load: (store, filters) => store.listRecommendations({ ...filters, limit: 6 }), summarize: (payload) => `Reviewed ${payload.length} operator recommendations.` },
  'control.read.agent-performance': { permission: 'analytics:read', load: (store, filters) => store.listAgentPerformance({ ...filters, limit: 6 }), summarize: (payload) => `Reviewed ${payload.length} agent performance snapshots.` },
};

function getScopeFilters(adminContext) {
  return adminContext.tenantId === PLATFORM_TENANT_ID && adminContext.appId === PLATFORM_APP_ID ? {} : { tenantId: adminContext.tenantId, appId: adminContext.appId };
}

function planIntent({ message, history, pathname, intent }) {
  if (intent) return intent;
  const normalized = message.toLowerCase();
  if (/tool|schema|permission|risk|registry/.test(normalized)) return 'tooling';
  if (/supply|demand|gap|market imbalance|research/.test(normalized)) return 'supply_gaps';
  if (/recommend|next action|priority|signal/.test(normalized)) return 'analytics';
  if (/throttled|queue|backlog|agent/.test(normalized)) return 'throttled_agents';
  if (/observability|service|health|cpu|memory|restart|error|hotspot/.test(normalized)) return 'observability';
  if (/event|activity|trigger/.test(normalized)) return 'events';
  if (/memory|vector|context store/.test(normalized)) return 'memory';
  if (/model|provider|planner|embedding/.test(normalized)) return 'models';
  if (/analytics|trend|kpi|usage|funnel/.test(normalized)) return 'analytics';
  if (/those|them|their|what about that/.test(normalized)) {
    const lastTool = [...history].reverse().flatMap((item) => [...item.toolCalls].reverse()).find((call) => call.status === 'completed')?.tool;
    if (lastTool === 'control.read.agents') return 'throttled_agents';
    if (lastTool === 'control.read.knowledge-graph') return 'supply_gaps';
    if (lastTool === 'control.read.observability') return 'observability';
    if (lastTool === 'control.read.events') return 'events';
    if (lastTool === 'control.read.tools') return 'tooling';
  }
  if (pathname?.startsWith('/tools')) return 'tooling';
  if (pathname?.startsWith('/agents')) return 'throttled_agents';
  if (pathname?.startsWith('/knowledge-graph')) return 'supply_gaps';
  if (pathname?.startsWith('/observability')) return 'observability';
  if (pathname?.startsWith('/events')) return 'events';
  if (pathname?.startsWith('/memory')) return 'memory';
  if (pathname?.startsWith('/models')) return 'models';
  if (pathname?.startsWith('/analytics')) return 'analytics';
  if (pathname?.startsWith('/agents')) return 'analytics';
  return 'overview';
}

function planMode({ route, mode, message }) {
  if (mode) return mode;
  const normalized = message.toLowerCase();
  if (route === 'recommend') return 'decide';
  if (route === 'research') return 'summarize';
  if (/plan|steps|runbook|remediate|how do we/.test(normalized)) return 'plan';
  if (/decide|choose|should we|best option|recommend/.test(normalized)) return 'decide';
  return 'summarize';
}

function selectTools(intent, mode) {
  const selected = new Set(mode === 'summarize' ? [] : ['control.read.tools', 'control.read.models']);
  if (intent === 'analytics') ['control.read.analytics', 'control.read.market-signals', 'control.read.recommendations', 'control.read.agent-performance'].forEach((tool) => selected.add(tool));
  else if (intent === 'throttled_agents') ['control.read.agents', 'control.read.events', 'control.read.agent-performance'].forEach((tool) => selected.add(tool));
  else if (intent === 'supply_gaps') ['control.read.knowledge-graph', 'control.read.agents', 'control.read.events', 'control.read.market-signals', 'control.read.recommendations'].forEach((tool) => selected.add(tool));
  else if (intent === 'observability') ['control.read.observability', 'control.read.events'].forEach((tool) => selected.add(tool));
  else if (intent === 'events') selected.add('control.read.events');
  else if (intent === 'memory') ['control.read.memory', 'control.read.models'].forEach((tool) => selected.add(tool));
  else if (intent === 'models') selected.add('control.read.models');
  else if (intent === 'tooling') ['control.read.tools', 'control.read.models'].forEach((tool) => selected.add(tool));
  else selected.add('control.read.overview');
  return [...selected];
}

async function invokeTool(store, adminContext, filters, tool) {
  const definition = toolDefinitions[tool];
  if (!hasPermission(adminContext.roles, definition.permission)) return { toolCall: { tool, permission: definition.permission, status: 'blocked', summary: `Missing ${definition.permission} permission for this reasoning tool.` } };
  try {
    const data = await definition.load(store, filters);
    return { data, toolCall: { tool, permission: definition.permission, status: 'completed', summary: definition.summarize(data) } };
  } catch (error) {
    return { toolCall: { tool, permission: definition.permission, status: 'failed', summary: error instanceof Error ? error.message : `Failed to execute ${tool}.` } };
  }
}

function getData(results, tool) {
  return results.find((result) => result.toolCall.tool === tool)?.data;
}

function appendMemorySignals(input, findings, actions) {
  if (!input.memoryContext) return;
  const preference = input.memoryContext.preferences?.[0];
  const priorTurn = input.memoryContext.conversation?.[0];
  const relevantItem = input.memoryContext.items?.[0];
  const agentExperience = input.memoryContext.agentExperiences?.[0];

  if (preference) {
    findings.push(`Operator preference: ${preference.key.replaceAll('_', ' ')} = ${preference.value}.`);
  }
  if (priorTurn) {
    findings.push(`Recent operator context: ${priorTurn.userMessage}`);
  }
  if (relevantItem) {
    findings.push(`Relevant long-term memory: ${relevantItem.title} — ${relevantItem.snippet}`);
  }
  if (agentExperience) {
    actions.push({ title: 'Apply prior agent learning', detail: `${agentExperience.agentId} previously recorded ${agentExperience.outcome} — ${agentExperience.summary}`, priority: 'medium' });
  }
}

function buildStructuredOutput({ input, intent, mode, results, maxActions }) {
  const overview = getData(results, 'control.read.overview');
  const analytics = getData(results, 'control.read.analytics');
  const agents = getData(results, 'control.read.agents') ?? [];
  const tools = getData(results, 'control.read.tools') ?? [];
  const graph = getData(results, 'control.read.knowledge-graph');
  const events = getData(results, 'control.read.events') ?? [];
  const observability = getData(results, 'control.read.observability') ?? [];
  const memory = getData(results, 'control.read.memory') ?? [];
  const models = getData(results, 'control.read.models') ?? [];
  const signals = getData(results, 'control.read.market-signals') ?? [];
  const recommendations = getData(results, 'control.read.recommendations') ?? [];
  const performance = getData(results, 'control.read.agent-performance') ?? [];
  const findings = [];
  const risks = [];
  const actions = [];

  if (intent === 'supply_gaps' && graph) {
    const hotNode = [...graph.nodes].sort((left, right) => right.score - left.score)[0];
    const hotEdge = [...graph.edges].sort((left, right) => right.strength - left.strength)[0];
    if (hotNode) findings.push(`Strongest graph signal: ${hotNode.label} (${hotNode.type}) scored ${hotNode.score.toFixed(2)}.`);
    if (hotEdge) findings.push(`Most relevant relationship: ${hotEdge.label} between ${hotEdge.source} and ${hotEdge.target}.`);
    if (agents[0]) findings.push(`Most active supporting agent: ${[...agents].sort((left, right) => right.decisionsToday - left.decisionsToday)[0].name}.`);
    if (events[0]) findings.push(`Latest correlated event: ${events[0].summary}`);
    if (signals[0]) findings.push(`Latest market signal: ${signals[0].signalType.replace(/_/g, ' ')} around ${signals[0].subject}.`);
    if (recommendations[0]) actions.push({ title: recommendations[0].title, detail: recommendations[0].summary, priority: recommendations[0].priority });
    actions.push({ title: 'Inspect hottest supply gap path', detail: 'Drill into the strongest node/edge pair and validate whether demand outpaced active supply.', priority: 'high' }, { title: 'Review supply-side automation', detail: 'Confirm the most active agent has enough budget and queue capacity to respond.', priority: 'medium' });
  } else if (intent === 'throttled_agents') {
    const throttled = agents.filter((agent) => agent.state === 'throttled');
    findings.push(`Throttled agents in scope: ${throttled.length}.`);
    if (agents[0]) findings.push(`Highest backlog agent: ${[...agents].sort((left, right) => right.queueDepth - left.queueDepth)[0].name}.`);
    if (performance[0]) findings.push(`Latest agent feedback score: ${performance[0].feedbackScore.toFixed(2)}.`);
    if (throttled.length) risks.push('Backlog pressure may delay time-sensitive automations and consume budget inefficiently.');
    actions.push({ title: 'Reduce queue pressure', detail: 'Pause or rebalance the noisiest agents and inspect recent failure/retry patterns.', priority: 'high' });
  } else if (intent === 'observability') {
    const unstable = observability.filter((service) => service.status !== 'healthy');
    findings.push(`Degraded services in scope: ${unstable.length}.`);
    if (observability[0]) findings.push(`Hottest service CPU: ${[...observability].sort((left, right) => right.cpuPercent - left.cpuPercent)[0].cpuPercent}%.`);
    if (unstable.length) risks.push('Service instability can amplify downstream queue backlog and user-visible errors.');
    actions.push({ title: 'Triage degraded services', detail: 'Start with the highest CPU/restart hotspots and compare against the latest event activity.', priority: 'high' });
  } else if (intent === 'events') {
    findings.push(`Recent events reviewed: ${events.length}.`);
    if (events[0]) findings.push(`Latest event: ${events[0].summary}`);
    actions.push({ title: 'Correlate latest events', detail: 'Map the most recent event burst to the owning service or agent for validation.', priority: 'medium' });
  } else if (intent === 'memory') {
    findings.push(`Memory scopes reviewed: ${memory.length}.`);
    if (memory[0]) findings.push(`Largest vector store: ${[...memory].sort((left, right) => right.vectorCount - left.vectorCount)[0].id}.`);
    actions.push({ title: 'Review memory density', detail: 'Check whether the largest scopes need compaction or retention tuning.', priority: 'medium' });
  } else if (intent === 'models') {
    findings.push(`Model routes reviewed: ${models.length}.`);
    if (models[0]) findings.push(`Slowest route: ${[...models].sort((left, right) => right.latencyMs - left.latencyMs)[0].key}.`);
    if (models[0]?.errorRate) risks.push('The slowest model route also raises the risk of user-facing timeout or fallback behavior.');
    actions.push({ title: 'Compare route candidates', detail: 'Review active vs fallback models for latency/error trade-offs before any switch.', priority: 'medium' });
  } else if (intent === 'tooling') {
    findings.push(`Tool contracts reviewed: ${tools.length}.`);
    if (tools[0]) findings.push(`Highest-risk tool in view: ${[...tools].sort((left, right) => (left.riskLevel < right.riskLevel ? 1 : -1))[0].name}.`);
    if (models[0]) findings.push(`Reasoning model boundary: ${models[0].activeModel} (${models[0].provider}).`);
    risks.push('High-risk tools should remain behind strict permission and audit boundaries.');
    actions.push({ title: 'Validate tool contracts', detail: 'Review schema, permissions, and risk posture before expanding tool access.', priority: 'high' });
  } else if (intent === 'analytics' && analytics) {
    findings.push(`Top KPI sample: ${analytics.kpis.slice(0, 3).map((item) => `${item.label} ${item.value}`).join(', ')}.`);
    findings.push(`Tracked tool-usage domains: ${analytics.toolUsageByDomain.length}.`);
    if (signals[0]) findings.push(`Most recent signal: ${signals[0].signalType.replace(/_/g, ' ')} for ${signals[0].subject}.`);
    if (recommendations[0]) findings.push(`Top recommendation: ${recommendations[0].title}.`);
    if (performance[0]) findings.push(`Best current feedback score: ${[...performance].sort((left, right) => right.feedbackScore - left.feedbackScore)[0].feedbackScore.toFixed(2)}.`);
    recommendations.slice(0, 2).forEach((item) => actions.push({ title: item.title, detail: item.summary, priority: item.priority }));
    actions.push({ title: 'Validate top KPI movement', detail: 'Check whether the current KPI movement aligns with the latest event and agent activity.', priority: 'medium' });
  } else if (overview) {
    findings.push(`Queue backlog is ${overview.queueBacklog} with ${overview.runningAgents} running agents.`);
    findings.push(`Healthy services: ${overview.healthyServices}; live events/min: ${overview.liveEventsPerMinute}.`);
    if (overview.queueBacklog > 400) risks.push('Backlog is elevated enough to threaten automation responsiveness.');
    actions.push({ title: 'Review top operational hotspots', detail: 'Inspect the areas contributing most to backlog, event volume, and service instability.', priority: 'high' });
  }

  appendMemorySignals(input, findings, actions);

  if (!findings.length) findings.push('Reasoning completed with limited readable data in the current scope.');
  const trimmedActions = actions.slice(0, maxActions);
  const decision = mode === 'decide' ? { recommendation: trimmedActions[0]?.title ? `${trimmedActions[0].title} first.` : 'Maintain current posture and continue monitoring.', confidence: findings.length >= 2 ? 0.78 : 0.54, rationale: [...findings.slice(0, 2), ...risks.slice(0, 2)].slice(0, 4) } : undefined;
  const content = mode === 'plan'
    ? [`Plan for: ${input.message}`, ...trimmedActions.map((action, index) => `${index + 1}. ${action.title} — ${action.detail}`), ...findings.slice(0, 2).map((finding) => `Signal: ${finding}`)].join('\n')
    : mode === 'decide'
      ? [`Decision: ${decision?.recommendation ?? 'No decisive recommendation available.'}`, `Confidence: ${Math.round((decision?.confidence ?? 0.5) * 100)}%`, ...(decision?.rationale.map((item) => `- ${item}`) ?? []), ...trimmedActions.slice(0, 2).map((action) => `Next: ${action.title} — ${action.detail}`)].join('\n')
      : [`Summary for: ${input.message}`, ...findings.map((finding) => `- ${finding}`), ...risks.slice(0, 2).map((risk) => `Risk: ${risk}`), trimmedActions[0] ? `Suggested action: ${trimmedActions[0].title} — ${trimmedActions[0].detail}` : null].filter(Boolean).join('\n');

  return { content, structuredOutput: { objective: input.message, findings: findings.slice(0, 6), risks: risks.slice(0, 6), actions: trimmedActions, decision } };
}

function buildProvider(mode, config) {
  const remoteEnabled = config.reasoningProvider === 'ollama' && Boolean(config.reasoningApiUrl);
  return { name: remoteEnabled ? 'ollama' : 'local-rules', model: config.reasoningModel || (mode === 'decide' ? 'Llama3.1-8B' : 'Mistral-7B-Instruct'), remoteEnabled };
}

async function maybeRewriteWithRemote(provider, structuredOutput, intent, mode, config) {
  if (!provider.remoteEnabled) return null;
  const response = await fetch(new URL('/api/generate', config.reasoningApiUrl).toString(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: provider.model, stream: false, prompt: ['You are a concise operator-facing reasoning engine.', `Mode: ${mode}`, `Intent: ${intent}`, `Structured output: ${JSON.stringify(structuredOutput)}`, 'Return a short, actionable response in plain text.'].join('\n\n') }) });
  if (!response.ok) throw new Error(`Remote reasoning provider failed with status ${response.status}.`);
  const payload = await response.json().catch(() => null);
  if (!payload?.response || typeof payload.response !== 'string') throw new Error('Remote reasoning provider returned an invalid response.');
  return payload.response.trim();
}

export function createReasoningEngine({ store, config = {} }) {
  return {
    async execute(input, adminContext) {
      const intent = planIntent(input);
      const mode = planMode(input);
      const results = await Promise.all(selectTools(intent, mode).map((tool) => invokeTool(store, adminContext, getScopeFilters(adminContext), tool)));
      const local = buildStructuredOutput({ input, intent, mode, results, maxActions: input.maxActions ?? 3 });
      const provider = buildProvider(mode, config);
      let content = local.content;
      let degraded = false;
      try {
        content = (await maybeRewriteWithRemote(provider, local.structuredOutput, intent, mode, config)) ?? content;
      } catch {
        degraded = provider.remoteEnabled;
      }
      return { mode, intent, provider, content, structuredOutput: local.structuredOutput, toolCalls: results.map((result) => result.toolCall), degraded };
    },
  };
}