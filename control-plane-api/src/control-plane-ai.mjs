import { hasPermission } from './authz.mjs';

function parseScore(message) {
  const match = message.match(/score\s+([01](?:\.\d+)?|0?\.\d+)/i);
  return match ? Number(match[1]) : 0.8;
}

function parseOutcomeStatus(message) {
  if (/blocked/i.test(message)) return 'blocked';
  if (/fail|failed/i.test(message)) return 'failed';
  if (/warn|warning/i.test(message)) return 'warning';
  return 'success';
}

function classifyCommand(message) {
  const normalized = message.toLowerCase();
  if (/(record|log).*(outcome|feedback)/.test(normalized)) return { intent: 'record_outcome', mode: 'act' };
  if (/(run|execute|trigger).*(recommendation agent)/.test(normalized)) return { intent: 'run_recommendation_agent', mode: 'act' };
  if (/(run|execute|trigger).*(insight agent)/.test(normalized)) return { intent: 'run_insight_agent', mode: 'act' };
  if (/(run|execute|trigger).*(research agent)/.test(normalized)) return { intent: 'run_research_agent', mode: 'act' };
  if (/prioriti[sz]e next actions|next actions|top recommendations/.test(normalized)) return { intent: 'prioritize_next_actions', mode: 'act' };
  if (/supply gaps|demand spikes|market signals/.test(normalized)) return { intent: 'show_supply_gaps', mode: 'read' };
  return { intent: 'summarize_system_health', mode: 'read' };
}

function resolveAgent(message, agents) {
  const normalized = message.toLowerCase();
  return agents.find((agent) => normalized.includes(agent.id.toLowerCase()))
    ?? agents.find((agent) => normalized.includes(agent.name.toLowerCase()))
    ?? agents[0]
    ?? null;
}

function completedTool(tool, permission, summary) {
  return { tool, permission, status: 'completed', summary };
}

function blockedTool(tool, permission, summary) {
  return { tool, permission, status: 'blocked', summary };
}

export function createControlPlaneAiService({ store, reasoningEngine, recommendationAgentService, insightAgentService, researchAgentService, feedbackLoopService }) {
  return {
    async execute(input, adminContext, filters = {}) {
      const classification = classifyCommand(input.message);
      const agents = await store.listAgents(filters);
      const targetAgent = resolveAgent(input.message, agents);
      const baseCommand = {
        intent: classification.intent,
        mode: classification.mode,
        targetAgentId: targetAgent?.id,
        executedActions: [],
        dryRun: false,
      };

      if (classification.intent === 'summarize_system_health') {
        const reasoning = await reasoningEngine.execute({ ...input, intent: 'observability', mode: 'summarize' }, adminContext);
        return { content: reasoning.message.content, suggestions: reasoning.suggestions, reasoning, toolCalls: reasoning.message.toolCalls, command: { ...baseCommand, executedActions: reasoning.message.toolCalls.map((item) => item.tool) } };
      }

      if (classification.intent === 'show_supply_gaps') {
        const reasoning = await reasoningEngine.execute({ ...input, intent: 'supply_gaps', mode: 'plan' }, adminContext);
        return { content: reasoning.message.content, suggestions: reasoning.suggestions, reasoning, toolCalls: reasoning.message.toolCalls, command: { ...baseCommand, executedActions: reasoning.message.toolCalls.map((item) => item.tool) } };
      }

      if (!targetAgent) {
        return {
          content: 'I could not identify a target agent for that command. Please mention an agent name or id.',
          suggestions: ['Run recommendation agent for Growth Concierge', 'Execute insight agent for Finance Copilot'],
          toolCalls: [blockedTool('control.run.recommendation-agent', 'agents:operate', 'No matching agent was found for this command.')],
          command: baseCommand,
        };
      }

      if (classification.intent === 'record_outcome') {
        if (!hasPermission(adminContext.roles, 'agents:operate')) {
          return {
            content: 'You do not have permission to record agent feedback outcomes.',
            suggestions: ['Ask a platform admin to record the outcome', 'Review current agent performance instead'],
            toolCalls: [blockedTool('control.write.feedback', 'agents:operate', 'Missing agents:operate permission.')],
            command: baseCommand,
          };
        }
        const result = await feedbackLoopService.recordOutcome({
          agentId: targetAgent.id,
          source: /recommend/i.test(input.message) ? 'recommendation' : 'manual',
          status: parseOutcomeStatus(input.message),
          score: parseScore(input.message),
          summary: input.message,
          metadata: { commandSource: 'control_plane_ai' },
        }, adminContext, { tenantId: targetAgent.tenantId, appId: targetAgent.appId });
        return {
          content: `Recorded a ${result.item.status} outcome for ${targetAgent.name} with score ${result.item.score.toFixed(2)}. Current feedback score is ${result.performance.feedbackScore.toFixed(2)} with ${Math.round(result.performance.successRate * 100)}% success rate.`,
          suggestions: ['Show current agent performance', 'Prioritize next actions for this agent'],
          toolCalls: [completedTool('control.write.feedback', 'agents:operate', `Recorded outcome ${result.item.id}.`)],
          command: { ...baseCommand, executedActions: ['control.write.feedback'] },
        };
      }

      if (!hasPermission(adminContext.roles, 'agents:operate')) {
        const tool = classification.intent === 'run_insight_agent' ? 'control.run.insight-agent' : classification.intent === 'run_research_agent' ? 'control.run.research-agent' : 'control.run.recommendation-agent';
        return {
          content: 'You do not have permission to run agent operations from the control-plane assistant.',
          suggestions: ['Review recommendations in read-only mode', 'Ask a platform admin to run the agent'],
          toolCalls: [blockedTool(tool, 'agents:operate', 'Missing agents:operate permission.')],
          command: baseCommand,
        };
      }

      if (classification.intent === 'run_insight_agent') {
        const result = await insightAgentService.execute({ agentId: targetAgent.id, signalLimit: 3, eventLimit: 15, usageLimit: 8, researchLimit: 4, metadata: { commandSource: 'control_plane_ai' } }, adminContext, { tenantId: targetAgent.tenantId, appId: targetAgent.appId });
        return {
          content: `Insight agent run completed for ${targetAgent.name}. Detected ${result.item.signalCount} signal(s): ${result.signals.slice(0, 3).map((item) => item.signalType).join(', ') || 'none'}.`,
          suggestions: ['Show market signals', 'Prioritize next actions'],
          toolCalls: [completedTool('control.run.insight-agent', 'agents:operate', `Executed insight run ${result.item.id}.`)],
          command: { ...baseCommand, executedActions: ['control.run.insight-agent'] },
        };
      }

      if (classification.intent === 'run_research_agent') {
        const result = await researchAgentService.execute({ agentId: targetAgent.id, source: 'platform_activity', query: `Follow-up research for ${targetAgent.name}`, limit: 3, persist: true, metadata: { commandSource: 'control_plane_ai' } }, adminContext, { tenantId: targetAgent.tenantId, appId: targetAgent.appId });
        return {
          content: `Research agent run completed for ${targetAgent.name}. Collected ${result.researchRun?.itemsCollected ?? 0} item(s) with status ${result.item.status}.`,
          suggestions: ['Prioritize next actions', 'Show recent recommendations'],
          toolCalls: [completedTool('control.run.research-agent', 'agents:operate', `Executed research run ${result.item.id}.`)],
          command: { ...baseCommand, executedActions: ['control.run.research-agent'] },
        };
      }

      const result = await recommendationAgentService.execute({ agentId: targetAgent.id, maxRecommendations: 4, signalLimit: 5, behaviorLimit: 8, documentLimit: 4, metadata: { commandSource: 'control_plane_ai' } }, adminContext, { tenantId: targetAgent.tenantId, appId: targetAgent.appId });
      return {
        content: result.recommendations.length
          ? `Prioritized next actions for ${targetAgent.name}: ${result.recommendations.map((item, index) => `${index + 1}. ${item.title}`).join(' ')}`
          : `Recommendation agent ran for ${targetAgent.name}, but no strong recommendations were generated.`,
        suggestions: ['Record a success outcome', 'Run insight agent for deeper signals'],
        toolCalls: [completedTool('control.run.recommendation-agent', 'agents:operate', `Executed recommendation run ${result.item.id}.`)],
        command: { ...baseCommand, executedActions: ['control.run.recommendation-agent'] },
      };
    },
  };
}