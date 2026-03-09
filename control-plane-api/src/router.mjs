function matchPath(pattern, pathname) {
  const routeParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);

  if (routeParts.length !== pathParts.length) {
    return null;
  }

  const params = {};
  for (const [index, part] of routeParts.entries()) {
    const current = pathParts[index];
    if (part.startsWith(':')) {
      params[part.slice(1)] = current;
      continue;
    }
    if (part !== current) {
      return null;
    }
  }

  return params;
}

export function createRoutes(handlers) {
  return [
    { method: 'GET', path: '/health', protected: false, handler: handlers.getHealth },
    { method: 'GET', path: '/admin/overview', protected: true, permission: 'analytics:read', handler: handlers.getOverview },
    { method: 'GET', path: '/admin/tenants', protected: true, permission: 'tenants:read', handler: handlers.getTenants },
    { method: 'POST', path: '/admin/tenants', protected: true, permission: 'tenants:write', handler: handlers.postTenant },
    { method: 'PATCH', path: '/admin/tenants/:tenantId', protected: true, permission: 'tenants:write', handler: handlers.patchTenant },
    { method: 'GET', path: '/admin/apps', protected: true, permission: 'apps:read', handler: handlers.getApps },
    { method: 'POST', path: '/admin/apps', protected: true, permission: 'apps:write', handler: handlers.postApp },
    { method: 'PATCH', path: '/admin/apps/:appId', protected: true, permission: 'apps:write', handler: handlers.patchApp },
    { method: 'GET', path: '/admin/users', protected: true, permission: 'users:read', handler: handlers.getUsers },
    { method: 'POST', path: '/admin/users', protected: true, permission: 'users:write', handler: handlers.postUser },
    { method: 'PATCH', path: '/admin/users/:userId', protected: true, permission: 'users:write', handler: handlers.patchUser },
    { method: 'GET', path: '/admin/agents', protected: true, permission: 'agents:read', handler: handlers.getAgents },
    { method: 'GET', path: '/admin/orchestrator/workflows', protected: true, permission: 'agents:read', handler: handlers.getOrchestratorWorkflows },
    { method: 'POST', path: '/admin/orchestrator/workflows', protected: true, permission: 'agents:operate', handler: handlers.postOrchestratorWorkflow },
    { method: 'GET', path: '/admin/research-agent/runs', protected: true, permission: 'agents:read', handler: handlers.getResearchAgentRuns },
    { method: 'POST', path: '/admin/research-agent/execute', protected: true, permission: 'agents:operate', handler: handlers.postResearchAgentExecute },
    { method: 'GET', path: '/admin/research-agent/triggers', protected: true, permission: 'agents:read', handler: handlers.getResearchAgentTriggers },
    { method: 'POST', path: '/admin/research-agent/triggers', protected: true, permission: 'agents:operate', handler: handlers.postResearchAgentTrigger },
    { method: 'POST', path: '/admin/research-agent/triggers/run-due', protected: true, permission: 'agents:operate', handler: handlers.postResearchAgentRunDue },
    { method: 'POST', path: '/admin/research-agent/triggers/process-events', protected: true, permission: 'agents:operate', handler: handlers.postResearchAgentProcessEvents },
    { method: 'GET', path: '/admin/insight-agent/runs', protected: true, permission: 'agents:read', handler: handlers.getInsightAgentRuns },
    { method: 'POST', path: '/admin/insight-agent/execute', protected: true, permission: 'agents:operate', handler: handlers.postInsightAgentExecute },
    { method: 'POST', path: '/admin/insight-agent/process-events', protected: true, permission: 'agents:operate', handler: handlers.postInsightAgentProcessEvents },
    { method: 'GET', path: '/admin/market-signals', protected: true, permission: 'analytics:read', handler: handlers.getMarketSignals },
    { method: 'GET', path: '/admin/recommendation-agent/runs', protected: true, permission: 'agents:read', handler: handlers.getRecommendationAgentRuns },
    { method: 'POST', path: '/admin/recommendation-agent/execute', protected: true, permission: 'agents:operate', handler: handlers.postRecommendationAgentExecute },
    { method: 'GET', path: '/admin/recommendations', protected: true, permission: 'analytics:read', handler: handlers.getRecommendations },
    { method: 'GET', path: '/admin/agent-performance', protected: true, permission: 'analytics:read', handler: handlers.getAgentPerformance },
    { method: 'GET', path: '/admin/agent-feedback/outcomes', protected: true, permission: 'analytics:read', handler: handlers.getAgentOutcomes },
    { method: 'POST', path: '/admin/agent-feedback/outcomes', protected: true, permission: 'agents:operate', handler: handlers.postAgentOutcome },
    { method: 'GET', path: '/admin/research/runs', protected: true, permission: 'research:read', handler: handlers.getResearchRuns },
    { method: 'POST', path: '/admin/research/collect', protected: true, permission: 'research:operate', handler: handlers.postResearchCollect },
    { method: 'GET', path: '/admin/research/schedules', protected: true, permission: 'research:read', handler: handlers.getResearchSchedules },
    { method: 'POST', path: '/admin/research/schedules', protected: true, permission: 'research:operate', handler: handlers.postResearchSchedule },
    { method: 'POST', path: '/admin/research/schedules/run-due', protected: true, permission: 'research:operate', handler: handlers.postResearchRunDue },
    {
      method: 'POST',
      path: '/admin/agents/:agentId/actions',
      protected: true,
      permission: 'agents:operate',
      handler: handlers.postAgentAction,
    },
    { method: 'POST', path: '/admin/orchestrator/workflows/:workflowId/lifecycle', protected: true, permission: 'agents:operate', handler: handlers.postOrchestratorWorkflowLifecycle },
    { method: 'POST', path: '/admin/orchestrator/workflows/:workflowId/aggregate', protected: true, permission: 'agents:operate', handler: handlers.postOrchestratorWorkflowAggregate },
    { method: 'GET', path: '/admin/tools', protected: true, permission: 'tools:read', handler: handlers.getTools },
    { method: 'POST', path: '/admin/tools/execute', protected: true, permission: 'tools:read', handler: handlers.postToolExecute },
    { method: 'GET', path: '/admin/tools/executions', protected: true, permission: 'tools:read', handler: handlers.getToolExecutions },
    { method: 'GET', path: '/admin/models', protected: true, permission: 'models:read', handler: handlers.getModels },
    {
      method: 'POST',
      path: '/admin/models/switch',
      protected: true,
      permission: 'models:switch',
      handler: handlers.postModelSwitch,
    },
    { method: 'POST', path: '/ai/recommend', protected: true, handler: handlers.postAiRecommend },
    { method: 'POST', path: '/ai/analyze', protected: true, handler: handlers.postAiAnalyze },
    { method: 'POST', path: '/ai/research', protected: true, handler: handlers.postAiResearch },
    { method: 'POST', path: '/ai/command', protected: true, handler: handlers.postAiCommand },
    { method: 'POST', path: '/embed', protected: true, handler: handlers.postEmbed },
    { method: 'POST', path: '/memory/conversations', protected: true, handler: handlers.postMemoryConversation },
    { method: 'GET', path: '/memory/conversations', protected: true, handler: handlers.getMemoryConversations },
    { method: 'POST', path: '/memory/preferences', protected: true, handler: handlers.postMemoryPreferences },
    { method: 'GET', path: '/memory/preferences', protected: true, handler: handlers.getMemoryPreferences },
    { method: 'POST', path: '/memory/experience', protected: true, handler: handlers.postMemoryExperience },
    { method: 'POST', path: '/memory/retrieve', protected: true, handler: handlers.postMemoryRetrieve },
    { method: 'GET', path: '/admin/memory', protected: true, permission: 'memory:read', handler: handlers.getMemory },
    {
      method: 'GET',
      path: '/admin/knowledge-graph',
      protected: true,
      permission: 'graph:read',
      handler: handlers.getKnowledgeGraph,
    },
    { method: 'GET', path: '/admin/events', protected: true, permission: 'events:read', handler: handlers.getEvents },
    { method: 'GET', path: '/admin/events/stream', protected: true, permission: 'events:read', handler: handlers.getEventsStream },
    { method: 'GET', path: '/admin/analytics', protected: true, permission: 'analytics:read', handler: handlers.getAnalytics },
    {
      method: 'GET',
      path: '/admin/observability',
      protected: true,
      permission: 'observability:read',
      handler: handlers.getObservability,
    },
    { method: 'GET', path: '/admin/audit', protected: true, permission: 'audit:read', handler: handlers.getAuditLogs },
    { method: 'GET', path: '/admin/system', protected: true, permission: 'system:write', handler: handlers.getSystem },
  ];
}

export function matchRoute(routes, method, pathname) {
  for (const route of routes) {
    if (route.method !== method) {
      continue;
    }
    const params = matchPath(route.path, pathname);
    if (params) {
      return { route, params };
    }
  }
  return null;
}
