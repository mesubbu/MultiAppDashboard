import { randomUUID } from 'node:crypto';

import { createControlPlaneAiService } from './control-plane-ai.mjs';
import { HttpError } from './http.mjs';
import { createReasoningEngine } from './reasoning-engine.mjs';

const PLATFORM_TENANT_ID = 'platform-root';
const PLATFORM_APP_ID = 'control-dashboard';
const MAX_CONCURRENT_REQUESTS = 2;
const MAX_BUDGET_UNITS_PER_MINUTE = 2400;

const promptTemplates = {
  recommend: 'operator_recommendations_v1',
  analyze: 'control_plane_analysis_v1',
  research: 'supply_gap_research_v1',
  command: 'control_plane_commands_v1',
};

const gatewayState = new Map();

function createAssistantMessage(content, toolCalls = []) {
  return { id: `assistant_${randomUUID()}`, role: 'assistant', content, createdAt: new Date().toISOString(), toolCalls };
}

function planIntent(message, history, pathname) {
  const normalized = message.toLowerCase();
  if (/(run|execute|trigger).*(agent)|record.*(outcome|feedback)/.test(normalized)) return 'command';
  if (/recommend|suggest|what should|next step|priority|prioritize/.test(normalized)) return 'recommend';
  if (/tool|schema|permission|risk|registry/.test(normalized)) return 'tooling';
  if (/supply|demand|gap|market imbalance|research/.test(normalized)) return 'supply_gaps';
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
  return 'overview';
}

function selectReasoningMode(route, message) {
  const normalized = message.toLowerCase();
  if (route === 'recommend') return 'decide';
  if (route === 'research') return 'summarize';
  if (/plan|steps|runbook|remediate|how do we/.test(normalized)) return 'plan';
  if (/decide|choose|should we|best option/.test(normalized)) return 'decide';
  return 'summarize';
}

function estimateUnits(input) {
  const historyLength = input.history.reduce((total, item) => total + item.content.length, 0);
  return Math.max(120, Math.ceil((input.message.length + historyLength) / 2) + input.history.length * 24);
}

function acquireLease(scopeKey, estimatedUnits) {
  const now = Date.now();
  const entry = gatewayState.get(scopeKey) ?? { inFlight: 0, usedUnits: 0, windowStartedAt: now };
  if (now - entry.windowStartedAt >= 60_000) {
    entry.windowStartedAt = now;
    entry.usedUnits = 0;
  }
  if (entry.inFlight >= MAX_CONCURRENT_REQUESTS) throw new HttpError(429, 'AI_GATEWAY_CONCURRENCY_LIMITED', 'The AI Gateway already has the maximum number of active requests for this scope.');
  if (entry.usedUnits + estimatedUnits > MAX_BUDGET_UNITS_PER_MINUTE) throw new HttpError(429, 'AI_GATEWAY_BUDGET_EXCEEDED', 'The AI Gateway request budget has been exhausted for this scope.');
  entry.inFlight += 1;
  entry.usedUnits += estimatedUnits;
  gatewayState.set(scopeKey, entry);
  return {
    guardrails: { concurrency: { limit: MAX_CONCURRENT_REQUESTS, inFlight: entry.inFlight }, budget: { estimatedUnits, remainingUnits: Math.max(0, MAX_BUDGET_UNITS_PER_MINUTE - entry.usedUnits), windowStartedAt: new Date(entry.windowStartedAt).toISOString() } },
    release() {
      const current = gatewayState.get(scopeKey);
      if (!current) return;
      current.inFlight = Math.max(0, current.inFlight - 1);
      gatewayState.set(scopeKey, current);
    },
  };
}

function formatSuggestions(intent) {
  if (intent === 'supply_gaps') return ['Show the hottest category-to-location paths', 'List the most relevant agents for this gap', 'Summarize recent demand-trigger events'];
  if (intent === 'throttled_agents') return ['Pause the noisiest agent', 'Review queue backlog by tenant', 'Inspect recent agent action events'];
  if (intent === 'observability') return ['Show services with restart alerts', 'Compare CPU hotspots by layer', 'List recent client errors'];
  if (intent === 'models') return ['Switch planner fallback options', 'Compare latency and error rates', 'Review embedding service usage'];
  if (intent === 'tooling') return ['Review tool risk posture', 'Compare tool permissions', 'Inspect active reasoning model routes'];
  if (intent === 'recommend') return ['Summarize the top operational priorities', 'Explain why those recommendations matter', 'Show the signals behind each recommendation'];
  return ['Drill into event activity', 'Review the underlying agents', 'Summarize operational risks'];
}

async function publishAiEvent(store, adminContext, type, summary, metadata) {
  if (!store.publishDomainEvent) return;
  await store.publishDomainEvent({ type, tenantId: adminContext.tenantId || PLATFORM_TENANT_ID, appId: adminContext.appId || PLATFORM_APP_ID, actor: adminContext.userId, actorDisplay: adminContext.userId, source: 'ai_gateway', resourceType: 'knowledge', resourceId: `ai_${randomUUID()}`, summary, metadata });
}

export function resetAiGatewayStateForTests() {
  gatewayState.clear();
}

export function createAiGateway({ store, config = {}, recommendationAgentService, insightAgentService, researchAgentService, feedbackLoopService }) {
  const reasoningEngine = createReasoningEngine({ store, config });
  const controlPlaneAiService = createControlPlaneAiService({ store, reasoningEngine, recommendationAgentService, insightAgentService, researchAgentService, feedbackLoopService });
  return {
    async analyze(input, adminContext) {
      const intent = planIntent(input.message, input.history, input.pathname);
      if (intent === 'command') return this.command(input, adminContext);
      if (intent === 'supply_gaps') return this.research(input, adminContext);
      if (intent === 'recommend') return this.recommend(input, adminContext);
      const lease = acquireLease(`${adminContext.tenantId}:${adminContext.appId}:${adminContext.userId}`, estimateUnits(input));
      try {
        const reasoning = await reasoningEngine.execute({ ...input, route: 'analyze', intent, mode: selectReasoningMode('analyze', input.message) }, adminContext);
        await publishAiEvent(store, adminContext, 'analysis_completed', `Completed AI analysis for ${reasoning.intent}.`, { route: 'analyze', intent: reasoning.intent, mode: reasoning.mode, provider: reasoning.provider.name, model: reasoning.provider.model, estimatedUnits: lease.guardrails.budget.estimatedUnits, degraded: reasoning.degraded });
        return { route: 'analyze', promptTemplate: promptTemplates.analyze, message: createAssistantMessage(reasoning.content, reasoning.toolCalls), suggestions: formatSuggestions(reasoning.intent), reasoning, degraded: reasoning.degraded, guardrails: lease.guardrails };
      } finally {
        lease.release();
      }
    },
    async research(input, adminContext) {
      const lease = acquireLease(`${adminContext.tenantId}:${adminContext.appId}:${adminContext.userId}`, estimateUnits(input));
      try {
        const reasoning = await reasoningEngine.execute({ ...input, route: 'research', intent: 'supply_gaps', mode: 'summarize' }, adminContext);
        await publishAiEvent(store, adminContext, 'research_requested', 'Started AI research workflow for a supply-gap style question.', { route: 'research', intent: reasoning.intent, mode: reasoning.mode, provider: reasoning.provider.name, model: reasoning.provider.model, estimatedUnits: lease.guardrails.budget.estimatedUnits, degraded: reasoning.degraded });
        return { route: 'research', promptTemplate: promptTemplates.research, message: createAssistantMessage(reasoning.content, reasoning.toolCalls), suggestions: formatSuggestions(reasoning.intent), reasoning, degraded: reasoning.degraded, guardrails: lease.guardrails };
      } finally {
        lease.release();
      }
    },
    async recommend(input, adminContext) {
      const intent = planIntent(input.message, input.history, input.pathname);
      const lease = acquireLease(`${adminContext.tenantId}:${adminContext.appId}:${adminContext.userId}`, estimateUnits(input));
      try {
        const reasoning = await reasoningEngine.execute({ ...input, route: 'recommend', intent: intent === 'recommend' ? 'analytics' : intent, mode: 'decide', maxActions: input.maxRecommendations ?? 3 }, adminContext);
        await publishAiEvent(store, adminContext, 'analysis_completed', 'Completed AI recommendation workflow.', { route: 'recommend', intent: reasoning.intent, mode: reasoning.mode, provider: reasoning.provider.name, model: reasoning.provider.model, estimatedUnits: lease.guardrails.budget.estimatedUnits, recommendations: reasoning.structuredOutput.actions.length, degraded: reasoning.degraded });
        return { route: 'recommend', promptTemplate: promptTemplates.recommend, message: createAssistantMessage(reasoning.content, reasoning.toolCalls), suggestions: formatSuggestions('recommend'), reasoning, degraded: reasoning.degraded, guardrails: lease.guardrails };
      } finally {
        lease.release();
      }
    },
    async command(input, adminContext) {
      const lease = acquireLease(`${adminContext.tenantId}:${adminContext.appId}:${adminContext.userId}`, estimateUnits(input));
      try {
        const result = await controlPlaneAiService.execute(input, adminContext, adminContext.tenantId === PLATFORM_TENANT_ID && adminContext.appId === PLATFORM_APP_ID ? {} : { tenantId: adminContext.tenantId, appId: adminContext.appId });
        await publishAiEvent(store, adminContext, 'analysis_completed', 'Completed control-plane AI command workflow.', { route: 'command', intent: result.command.intent, mode: result.command.mode, estimatedUnits: lease.guardrails.budget.estimatedUnits, executedActions: result.command.executedActions });
        return { route: 'command', promptTemplate: promptTemplates.command, message: createAssistantMessage(result.content, result.toolCalls), suggestions: result.suggestions, reasoning: result.reasoning, command: result.command, degraded: false, guardrails: lease.guardrails };
      } finally {
        lease.release();
      }
    },
  };
}