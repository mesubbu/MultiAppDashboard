import {
  agentActionRequestSchema,
  agentActionResponseSchema,
  agentListResponseSchema,
  agentPageResponseSchema,
  aiAnalyzeRequestSchema,
  aiGatewayResponseSchema,
  aiRecommendRequestSchema,
  aiResearchRequestSchema,
  analyticsResponseSchema,
  auditListResponseSchema,
  auditPageResponseSchema,
  appCreateRequestSchema,
  appListResponseSchema,
  appPageResponseSchema,
  appMutationResponseSchema,
  appUpdateRequestSchema,
  embedRequestSchema,
  embedResponseSchema,
  eventListResponseSchema,
  eventPageResponseSchema,
  agentOutcomeListResponseSchema,
  agentOutcomeMutationResponseSchema,
  agentOutcomeRecordRequestSchema,
  agentPerformanceListResponseSchema,
  insightAgentExecuteRequestSchema,
  insightAgentExecuteResponseSchema,
  insightAgentProcessEventsResponseSchema,
  insightAgentRunListResponseSchema,
  knowledgeGraphResponseSchema,
  marketSignalListResponseSchema,
  memoryAgentExperienceResponseSchema,
  memoryAgentExperienceWriteRequestSchema,
  memoryConversationListResponseSchema,
  memoryConversationWriteRequestSchema,
  memoryListResponseSchema,
  memoryPageResponseSchema,
  memoryPreferenceListResponseSchema,
  memoryPreferenceWriteRequestSchema,
  memoryRetrieveRequestSchema,
  memoryRetrieveResponseSchema,
  modelListResponseSchema,
  modelSwitchRequestSchema,
  modelSwitchResponseSchema,
  observabilityResponseSchema,
  observabilityPageResponseSchema,
  orchestratorAggregateRequestSchema,
  orchestratorLifecycleRequestSchema,
  orchestratorScheduleRequestSchema,
  orchestratorWorkflowListResponseSchema,
  orchestratorWorkflowMutationResponseSchema,
  recommendationAgentExecuteRequestSchema,
  recommendationAgentExecuteResponseSchema,
  recommendationAgentRunListResponseSchema,
  recommendationListResponseSchema,
  researchCollectRequestSchema,
  researchCollectResponseSchema,
  researchAgentExecuteRequestSchema,
  researchAgentExecuteResponseSchema,
  researchAgentRunListResponseSchema,
  researchAgentTriggerCreateRequestSchema,
  researchAgentTriggerListResponseSchema,
  researchAgentTriggerMutationResponseSchema,
  researchAgentTriggerRunResponseSchema,
  researchRunDueResponseSchema,
  researchRunListResponseSchema,
  researchScheduleCreateRequestSchema,
  researchScheduleListResponseSchema,
  researchScheduleMutationResponseSchema,
  overviewResponseSchema,
  systemResponseSchema,
  tenantCreateRequestSchema,
  tenantListResponseSchema,
  tenantPageResponseSchema,
  tenantMutationResponseSchema,
  tenantUpdateRequestSchema,
  toolExecuteRequestSchema,
  toolExecuteResponseSchema,
  toolExecutionListResponseSchema,
  toolListResponseSchema,
  toolPageResponseSchema,
  userCreateRequestSchema,
  userListResponseSchema,
  userPageResponseSchema,
  userMutationResponseSchema,
  userUpdateRequestSchema,
} from './contracts.mjs';
import {
  hasListQuery,
  isWithinDateRange,
  isWithinTimeRange,
  paginateItems,
  parseAgentListQuery,
  parseAuditListQuery,
  parseAppListQuery,
  parseEventListQuery,
  parseMemoryListQuery,
  parseObservabilityListQuery,
  parseTenantListQuery,
  parseToolListQuery,
  parseUserListQuery,
} from './catalog-list-query.mjs';
import { createAiGateway } from './ai-gateway.mjs';
import { createAgentOrchestratorService } from './agent-orchestrator.mjs';
import { createEmbeddingsService } from './embeddings-service.mjs';
import { createFeedbackLoopService } from './feedback-loop.mjs';
import { createInsightAgentService } from './insight-agent.mjs';
import { createMemoryService } from './memory-service.mjs';
import { createRecommendationAgentService } from './recommendation-agent.mjs';
import { createResearchAgentService } from './research-agent.mjs';
import { createResearchService } from './research-service.mjs';
import { createToolService } from './tool-service.mjs';
import { setCorsHeaders } from './http.mjs';
import { parseKnowledgeGraphQuery } from './knowledge-graph.mjs';

const PLATFORM_TENANT_ID = 'platform-root';
const PLATFORM_APP_ID = 'control-dashboard';

function buildSyntheticEvent(seedEvents, sequence) {
  const template = seedEvents[sequence % Math.max(seedEvents.length, 1)] ?? {
    id: 'event_live_fallback',
    tenantId: PLATFORM_TENANT_ID,
    appId: PLATFORM_APP_ID,
    type: 'agent_triggered',
    actor: 'system',
    summary: 'Live control-plane heartbeat emitted.',
  };

  return {
    ...template,
    id: `event_live_${template.id}_${Date.now()}_${sequence}`,
    timestamp: new Date(Date.now() + sequence).toISOString(),
    summary: template.summary.endsWith('· live update')
      ? template.summary
      : `${template.summary} · live update`,
  };
}

function formatSseChunk(payload, retryMs) {
  const retryPrefix = retryMs ? `retry: ${retryMs}\n` : '';
  return `${retryPrefix}data: ${JSON.stringify(payload)}\n\n`;
}

function formatSseComment(comment) {
  return `: ${comment}\n\n`;
}

function getScopeFilters(url, adminContext) {
  const headerTenantId =
    adminContext?.tenantId && adminContext.tenantId !== PLATFORM_TENANT_ID
      ? adminContext.tenantId
      : undefined;
  const tenantId = headerTenantId ?? url.searchParams.get('tenant_id') ?? undefined;

  const headerAppId =
    adminContext?.appId && adminContext.appId !== PLATFORM_APP_ID ? adminContext.appId : undefined;
  const appId = headerAppId ?? (tenantId ? url.searchParams.get('app_id') ?? undefined : undefined);

  return { tenantId, appId };
}

function matchesQuery(values, query) {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.toLowerCase();
  return values.some((value) => `${value}`.toLowerCase().includes(normalizedQuery));
}

function filterTenantPageItems(items, query) {
  return items.filter(
    (tenant) =>
      (!query.status || tenant.status === query.status) &&
      matchesQuery([tenant.id, tenant.name, tenant.region, tenant.tier], query.query),
  );
}

function filterAppPageItems(items, query) {
  return items.filter(
    (app) =>
      (!query.status || app.status === query.status) &&
      (!query.environment || app.environment === query.environment) &&
      matchesQuery([app.id, app.name, app.region, app.runtime, app.tenantId], query.query),
  );
}

function filterUserPageItems(items, query) {
  return items.filter(
    (user) =>
      (!query.status || user.status === query.status) &&
      (!query.role || user.role === query.role) &&
      matchesQuery([user.id, user.name, user.tenantId, user.appId, user.role], query.query),
  );
}

function filterAgentPageItems(items, query) {
  return items.filter(
    (agent) =>
      (!query.tenantId || agent.tenantId === query.tenantId) &&
      (!query.appId || agent.appId === query.appId) &&
      (!query.status || agent.state === query.status) &&
      isWithinTimeRange(agent.lastHeartbeatAt, query.timeRange) &&
      matchesQuery([agent.id, agent.name, agent.queue, agent.workflowVersion], query.query),
  );
}

function filterToolPageItems(items, query) {
  return items.filter((tool) =>
    matchesQuery([tool.name, tool.description, tool.schema, tool.permissions.join(' '), tool.riskLevel, tool.executionMode, tool.safetyGuards.join(' ')], query.query),
  );
}

function filterMemoryPageItems(items, query) {
  return items.filter(
    (item) =>
      (!query.tenantId || item.tenantId === query.tenantId) &&
      (!query.appId || item.appId === query.appId) &&
      (!query.scope || item.scope === query.scope) &&
      isWithinTimeRange(item.lastCompactionAt, query.timeRange) &&
      matchesQuery([item.id, item.scope, item.tenantId, item.appId], query.query),
  );
}

function filterEventPageItems(items, query) {
  return items.filter(
    (item) =>
      (!query.tenantId || item.tenantId === query.tenantId) &&
      (!query.appId || item.appId === query.appId) &&
      (!query.eventType || item.type === query.eventType) &&
      isWithinTimeRange(item.timestamp, query.timeRange) &&
      matchesQuery([item.id, item.type, item.actor, item.summary], query.query),
  );
}

function filterObservabilityItems(items, query) {
  return items.filter(
    (item) =>
      (!query.status || item.status === query.status) &&
      matchesQuery([item.name, item.layer, item.endpoint], query.query),
  );
}

function filterClientErrors(items, query) {
  return items.filter(
    (item) =>
      (!query.tenantId || item.tenantId === query.tenantId) &&
      (!query.appId || item.appId === query.appId) &&
      isWithinTimeRange(item.occurredAt, query.timeRange) &&
      matchesQuery([item.id, item.kind, item.source, item.message, item.pathname], query.query),
  );
}

function filterAuditPageItems(items, query) {
  return items.filter(
    (item) =>
      (!query.tenantId || item.tenantId === query.tenantId) &&
      (!query.appId || item.appId === query.appId) &&
      (!query.actor || item.actor === query.actor) &&
      (!query.action || item.action === query.action) &&
      (!query.resourceType || item.resourceType === query.resourceType) &&
      isWithinDateRange(item.timestamp, query.from, query.to) &&
      matchesQuery([item.actor, item.actorDisplay, item.resourceId, item.summary], query.query),
  );
}

export function createHandlers({ store, config, startedAt }) {
  const orchestratorService = createAgentOrchestratorService({ store });
  const embeddingsService = createEmbeddingsService({ store, config });
  const insightAgentService = createInsightAgentService({ store });
  const memoryService = createMemoryService({ store, config });
  const researchService = createResearchService({ store, embeddingsService });
  const researchAgentService = createResearchAgentService({ store, researchService });
  const recommendationAgentService = createRecommendationAgentService({ store, embeddingsService });
  const feedbackLoopService = createFeedbackLoopService({ store });
  const aiGateway = createAiGateway({
    store,
    config,
    embeddingsService,
    recommendationAgentService,
    insightAgentService,
    researchAgentService,
    feedbackLoopService,
  });
  const toolService = createToolService({ store });

  return {
    async getHealth() {
      return {
        statusCode: 200,
        body: {
          name: 'control-plane-api',
          environment: config.environment,
          uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
          ...(await store.getHealth()),
        },
      };
    },
    async getOverview({ url, adminContext }) {
      return {
        statusCode: 200,
        body: overviewResponseSchema.parse(await store.getOverview(getScopeFilters(url, adminContext))),
      };
    },
    async getTenants({ url, adminContext }) {
      const tenants = await store.listTenants(getScopeFilters(url, adminContext));
      if (hasListQuery(url.searchParams)) {
        const query = parseTenantListQuery(url.searchParams);
        return {
          statusCode: 200,
          body: tenantPageResponseSchema.parse(paginateItems(filterTenantPageItems(tenants, query), query)),
        };
      }

      return {
        statusCode: 200,
        body: tenantListResponseSchema.parse({ items: tenants }),
      };
    },
    async postTenant({ body, adminContext }) {
      const payload = tenantCreateRequestSchema.parse(body);
      return {
        statusCode: 200,
        body: tenantMutationResponseSchema.parse({
          ok: true,
          item: await store.createTenant(payload, adminContext),
        }),
      };
    },
    async patchTenant({ params, body, adminContext }) {
      const payload = tenantUpdateRequestSchema.parse(body);
      return {
        statusCode: 200,
        body: tenantMutationResponseSchema.parse({
          ok: true,
          item: await store.updateTenant(params.tenantId, payload, adminContext),
        }),
      };
    },
    async getApps({ url, adminContext }) {
      const apps = await store.listApps(getScopeFilters(url, adminContext));
      if (hasListQuery(url.searchParams, ['environment'])) {
        const query = parseAppListQuery(url.searchParams);
        return {
          statusCode: 200,
          body: appPageResponseSchema.parse(paginateItems(filterAppPageItems(apps, query), query)),
        };
      }

      return {
        statusCode: 200,
        body: appListResponseSchema.parse({ items: apps }),
      };
    },
    async postApp({ body, adminContext }) {
      const payload = appCreateRequestSchema.parse(body);
      return {
        statusCode: 200,
        body: appMutationResponseSchema.parse({
          ok: true,
          item: await store.createApp(payload, adminContext),
        }),
      };
    },
    async patchApp({ params, body, adminContext }) {
      const payload = appUpdateRequestSchema.parse(body);
      return {
        statusCode: 200,
        body: appMutationResponseSchema.parse({
          ok: true,
          item: await store.updateApp(params.appId, payload, adminContext),
        }),
      };
    },
    async getUsers({ url, adminContext }) {
      const users = await store.listUsers(getScopeFilters(url, adminContext));
      if (hasListQuery(url.searchParams, ['role'])) {
        const query = parseUserListQuery(url.searchParams);
        return {
          statusCode: 200,
          body: userPageResponseSchema.parse(paginateItems(filterUserPageItems(users, query), query)),
        };
      }

      return {
        statusCode: 200,
        body: userListResponseSchema.parse({ items: users }),
      };
    },
    async postUser({ body, adminContext }) {
      const payload = userCreateRequestSchema.parse(body);
      return {
        statusCode: 200,
        body: userMutationResponseSchema.parse({
          ok: true,
          item: await store.createUser(payload, adminContext),
        }),
      };
    },
    async patchUser({ params, body, adminContext }) {
      const payload = userUpdateRequestSchema.parse(body);
      return {
        statusCode: 200,
        body: userMutationResponseSchema.parse({
          ok: true,
          item: await store.updateUser(params.userId, payload, adminContext),
        }),
      };
    },
    async getAgents({ url, adminContext }) {
      const agents = await store.listAgents(getScopeFilters(url, adminContext));
      if (hasListQuery(url.searchParams)) {
        const query = parseAgentListQuery(url.searchParams);
        return {
          statusCode: 200,
          body: agentPageResponseSchema.parse(paginateItems(filterAgentPageItems(agents, query), query)),
        };
      }

      return {
        statusCode: 200,
        body: agentListResponseSchema.parse({ items: agents }),
      };
    },
    async getOrchestratorWorkflows({ url, adminContext }) {
      return {
        statusCode: 200,
        body: orchestratorWorkflowListResponseSchema.parse({
          items: await orchestratorService.listWorkflows({
            status: url.searchParams.get('status') ?? undefined,
            agentId: url.searchParams.get('agent_id') ?? undefined,
            limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
          }, getScopeFilters(url, adminContext)),
        }),
      };
    },
    async getResearchRuns({ url, adminContext }) {
      return {
        statusCode: 200,
        body: researchRunListResponseSchema.parse({
          items: await researchService.listRuns({
            source: url.searchParams.get('source') ?? undefined,
            status: url.searchParams.get('status') ?? undefined,
            scheduleId: url.searchParams.get('schedule_id') ?? undefined,
            limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
          }, getScopeFilters(url, adminContext)),
        }),
      };
    },
    async postResearchCollect({ body, adminContext, url }) {
      return {
        statusCode: 200,
        body: researchCollectResponseSchema.parse(
          await researchService.collect(researchCollectRequestSchema.parse(body), adminContext, getScopeFilters(url, adminContext)),
        ),
      };
    },
    async getResearchSchedules({ url, adminContext }) {
      return {
        statusCode: 200,
        body: researchScheduleListResponseSchema.parse({
          items: await researchService.listSchedules({
            source: url.searchParams.get('source') ?? undefined,
            status: url.searchParams.get('status') ?? undefined,
            limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
          }, getScopeFilters(url, adminContext)),
        }),
      };
    },
    async getResearchAgentRuns({ url, adminContext }) {
      return {
        statusCode: 200,
        body: researchAgentRunListResponseSchema.parse({
          items: await researchAgentService.listRuns({
            agentId: url.searchParams.get('agent_id') ?? undefined,
            status: url.searchParams.get('status') ?? undefined,
            trigger: url.searchParams.get('trigger') ?? undefined,
            limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
          }, getScopeFilters(url, adminContext)),
        }),
      };
    },
    async postResearchAgentExecute({ body, adminContext, url }) {
      return {
        statusCode: 200,
        body: researchAgentExecuteResponseSchema.parse(
          await researchAgentService.execute(
            researchAgentExecuteRequestSchema.parse(body),
            adminContext,
            getScopeFilters(url, adminContext),
            { trigger: 'manual' },
          ),
        ),
      };
    },
    async getResearchAgentTriggers({ url, adminContext }) {
      return {
        statusCode: 200,
        body: researchAgentTriggerListResponseSchema.parse({
          items: await researchAgentService.listTriggers({
            agentId: url.searchParams.get('agent_id') ?? undefined,
            triggerType: url.searchParams.get('trigger_type') ?? undefined,
            status: url.searchParams.get('status') ?? undefined,
            limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
          }, getScopeFilters(url, adminContext)),
        }),
      };
    },
    async postResearchAgentTrigger({ body, adminContext, url }) {
      return {
        statusCode: 200,
        body: researchAgentTriggerMutationResponseSchema.parse(
          await researchAgentService.createTrigger(
            researchAgentTriggerCreateRequestSchema.parse(body),
            adminContext,
            getScopeFilters(url, adminContext),
          ),
        ),
      };
    },
    async postResearchAgentRunDue({ adminContext, url }) {
      return {
        statusCode: 200,
        body: researchAgentTriggerRunResponseSchema.parse(
          await researchAgentService.runDueTriggers(adminContext, {
            ...getScopeFilters(url, adminContext),
            limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
          }),
        ),
      };
    },
    async postResearchAgentProcessEvents({ adminContext, url }) {
      return {
        statusCode: 200,
        body: researchAgentTriggerRunResponseSchema.parse(
          await researchAgentService.processEventTriggers(adminContext, {
            ...getScopeFilters(url, adminContext),
            limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
          }),
        ),
      };
    },
    async getInsightAgentRuns({ url, adminContext }) {
      return {
        statusCode: 200,
        body: insightAgentRunListResponseSchema.parse({
          items: await insightAgentService.listRuns({
            agentId: url.searchParams.get('agent_id') ?? undefined,
            status: url.searchParams.get('status') ?? undefined,
            trigger: url.searchParams.get('trigger') ?? undefined,
            limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
          }, getScopeFilters(url, adminContext)),
        }),
      };
    },
    async postInsightAgentExecute({ body, adminContext, url }) {
      return {
        statusCode: 200,
        body: insightAgentExecuteResponseSchema.parse(
          await insightAgentService.execute(
            insightAgentExecuteRequestSchema.parse(body),
            adminContext,
            getScopeFilters(url, adminContext),
          ),
        ),
      };
    },
    async postInsightAgentProcessEvents({ body, adminContext, url }) {
      return {
        statusCode: 200,
        body: insightAgentProcessEventsResponseSchema.parse(
          await insightAgentService.processEvents(
            insightAgentExecuteRequestSchema.parse(body),
            adminContext,
            getScopeFilters(url, adminContext),
          ),
        ),
      };
    },
    async getMarketSignals({ url, adminContext }) {
      return {
        statusCode: 200,
        body: marketSignalListResponseSchema.parse({
          items: await insightAgentService.listSignals({
            signalType: url.searchParams.get('signal_type') ?? undefined,
            direction: url.searchParams.get('direction') ?? undefined,
            limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
          }, getScopeFilters(url, adminContext)),
        }),
      };
    },
    async getRecommendationAgentRuns({ url, adminContext }) {
      return {
        statusCode: 200,
        body: recommendationAgentRunListResponseSchema.parse({
          items: await recommendationAgentService.listRuns({
            agentId: url.searchParams.get('agent_id') ?? undefined,
            status: url.searchParams.get('status') ?? undefined,
            limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
          }, getScopeFilters(url, adminContext)),
        }),
      };
    },
    async postRecommendationAgentExecute({ body, adminContext, url }) {
      return {
        statusCode: 200,
        body: recommendationAgentExecuteResponseSchema.parse(
          await recommendationAgentService.execute(
            recommendationAgentExecuteRequestSchema.parse(body),
            adminContext,
            getScopeFilters(url, adminContext),
          ),
        ),
      };
    },
    async getRecommendations({ url, adminContext }) {
      return {
        statusCode: 200,
        body: recommendationListResponseSchema.parse({
          items: await recommendationAgentService.listRecommendations({
            agentId: url.searchParams.get('agent_id') ?? undefined,
            category: url.searchParams.get('category') ?? undefined,
            priority: url.searchParams.get('priority') ?? undefined,
            limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
          }, getScopeFilters(url, adminContext)),
        }),
      };
    },
    async postAgentOutcome({ body, adminContext, url }) {
      return {
        statusCode: 200,
        body: agentOutcomeMutationResponseSchema.parse(
          await feedbackLoopService.recordOutcome(
            agentOutcomeRecordRequestSchema.parse(body),
            adminContext,
            getScopeFilters(url, adminContext),
          ),
        ),
      };
    },
    async getAgentOutcomes({ url, adminContext }) {
      return {
        statusCode: 200,
        body: agentOutcomeListResponseSchema.parse({
          items: await feedbackLoopService.listOutcomes({
            agentId: url.searchParams.get('agent_id') ?? undefined,
            status: url.searchParams.get('status') ?? undefined,
            limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
          }, getScopeFilters(url, adminContext)),
        }),
      };
    },
    async getAgentPerformance({ url, adminContext }) {
      return {
        statusCode: 200,
        body: agentPerformanceListResponseSchema.parse(
          await feedbackLoopService.listPerformance({
            agentId: url.searchParams.get('agent_id') ?? undefined,
            limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
          }, getScopeFilters(url, adminContext)),
        ),
      };
    },
    async postResearchSchedule({ body, adminContext }) {
      return {
        statusCode: 200,
        body: researchScheduleMutationResponseSchema.parse(
          await researchService.createSchedule(researchScheduleCreateRequestSchema.parse(body), adminContext),
        ),
      };
    },
    async postResearchRunDue({ adminContext, url }) {
      return {
        statusCode: 200,
        body: researchRunDueResponseSchema.parse(
          await researchService.runDueSchedules(adminContext, {
            ...getScopeFilters(url, adminContext),
            limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
          }),
        ),
      };
    },
    async postOrchestratorWorkflow({ body, adminContext, url }) {
      return {
        statusCode: 200,
        body: orchestratorWorkflowMutationResponseSchema.parse(
          await orchestratorService.scheduleWorkflow(orchestratorScheduleRequestSchema.parse(body), adminContext, getScopeFilters(url, adminContext)),
        ),
      };
    },
    async postAgentAction({ params, body, adminContext, url }) {
      const payload = agentActionRequestSchema.parse(body);
      const result = await store.updateAgent(
        params.agentId,
        payload,
        adminContext.userId,
        getScopeFilters(url, adminContext),
      );
      return {
        statusCode: 200,
        body: agentActionResponseSchema.parse({
          ok: true,
          agent: result.agent,
          audit: result.audit,
        }),
      };
    },
    async postOrchestratorWorkflowLifecycle({ params, body, adminContext, url }) {
      return {
        statusCode: 200,
        body: orchestratorWorkflowMutationResponseSchema.parse(
          await orchestratorService.updateWorkflowLifecycle(params.workflowId, orchestratorLifecycleRequestSchema.parse(body), adminContext, getScopeFilters(url, adminContext)),
        ),
      };
    },
    async postOrchestratorWorkflowAggregate({ params, body, adminContext, url }) {
      return {
        statusCode: 200,
        body: orchestratorWorkflowMutationResponseSchema.parse(
          await orchestratorService.aggregateWorkflow(params.workflowId, orchestratorAggregateRequestSchema.parse(body), adminContext, getScopeFilters(url, adminContext)),
        ),
      };
    },
    async getTools({ url }) {
      const tools = await toolService.listTools();
      if (hasListQuery(url.searchParams)) {
        const query = parseToolListQuery(url.searchParams);
        return {
          statusCode: 200,
          body: toolPageResponseSchema.parse(paginateItems(filterToolPageItems(tools, query), query)),
        };
      }

      return {
        statusCode: 200,
        body: toolListResponseSchema.parse({ items: tools }),
      };
    },
    async postToolExecute({ body, adminContext, url }) {
      return {
        statusCode: 200,
        body: toolExecuteResponseSchema.parse(await toolService.executeTool(toolExecuteRequestSchema.parse(body), adminContext, getScopeFilters(url, adminContext))),
      };
    },
    async getToolExecutions({ url, adminContext }) {
      return {
        statusCode: 200,
        body: toolExecutionListResponseSchema.parse({
          items: await toolService.listExecutions({
            tool: url.searchParams.get('tool') ?? undefined,
            status: url.searchParams.get('status') ?? undefined,
            limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
          }, adminContext),
        }),
      };
    },
    async getModels() {
      return {
        statusCode: 200,
        body: modelListResponseSchema.parse({ items: await store.listModels() }),
      };
    },
    async postModelSwitch({ body, adminContext }) {
      const payload = modelSwitchRequestSchema.parse(body);
      const result = await store.switchModel(payload, adminContext.userId);
      return {
        statusCode: 200,
        body: modelSwitchResponseSchema.parse({
          ok: true,
          model: result.model,
          audit: result.audit,
        }),
      };
    },
    async postAiRecommend({ body, adminContext }) {
      return {
        statusCode: 200,
        body: aiGatewayResponseSchema.parse(await aiGateway.recommend(aiRecommendRequestSchema.parse(body), adminContext)),
      };
    },
    async postAiAnalyze({ body, adminContext }) {
      return {
        statusCode: 200,
        body: aiGatewayResponseSchema.parse(await aiGateway.analyze(aiAnalyzeRequestSchema.parse(body), adminContext)),
      };
    },
    async postAiResearch({ body, adminContext }) {
      return {
        statusCode: 200,
        body: aiGatewayResponseSchema.parse(await aiGateway.research(aiResearchRequestSchema.parse(body), adminContext)),
      };
    },
    async postAiCommand({ body, adminContext }) {
      return {
        statusCode: 200,
        body: aiGatewayResponseSchema.parse(await aiGateway.command(aiAnalyzeRequestSchema.parse(body), adminContext)),
      };
    },
    async postEmbed({ body, adminContext }) {
      return {
        statusCode: 200,
        body: embedResponseSchema.parse(await embeddingsService.embed(embedRequestSchema.parse(body), adminContext)),
      };
    },
    async postMemoryConversation({ body, adminContext }) {
      return {
        statusCode: 200,
        body: memoryConversationListResponseSchema.parse({ items: [await memoryService.saveConversationTurn(memoryConversationWriteRequestSchema.parse(body), adminContext)] }),
      };
    },
    async getMemoryConversations({ url, adminContext }) {
      const items = await memoryService.listConversationTurns({
        sessionId: url.searchParams.get('session_id') ?? undefined,
        limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
      }, adminContext);
      return {
        statusCode: 200,
        body: memoryConversationListResponseSchema.parse({ items }),
      };
    },
    async postMemoryPreferences({ body, adminContext }) {
      return {
        statusCode: 200,
        body: memoryPreferenceListResponseSchema.parse({ items: await memoryService.upsertPreferences(memoryPreferenceWriteRequestSchema.parse(body), adminContext) }),
      };
    },
    async getMemoryPreferences({ adminContext }) {
      return {
        statusCode: 200,
        body: memoryPreferenceListResponseSchema.parse({ items: await memoryService.listPreferences(adminContext) }),
      };
    },
    async postMemoryExperience({ body, adminContext }) {
      return {
        statusCode: 200,
        body: memoryAgentExperienceResponseSchema.parse({ item: await memoryService.recordAgentExperience(memoryAgentExperienceWriteRequestSchema.parse(body), adminContext) }),
      };
    },
    async postMemoryRetrieve({ body, adminContext }) {
      return {
        statusCode: 200,
        body: memoryRetrieveResponseSchema.parse(await memoryService.retrieveContext(memoryRetrieveRequestSchema.parse(body), adminContext)),
      };
    },
    async getMemory({ url, adminContext }) {
      const items = await store.listMemory(getScopeFilters(url, adminContext));
      if (hasListQuery(url.searchParams, ['scope'])) {
        const query = parseMemoryListQuery(url.searchParams);
        return {
          statusCode: 200,
          body: memoryPageResponseSchema.parse(paginateItems(filterMemoryPageItems(items, query), query)),
        };
      }

      return {
        statusCode: 200,
        body: memoryListResponseSchema.parse({ items }),
      };
    },
    async getKnowledgeGraph({ url, adminContext }) {
      const query = parseKnowledgeGraphQuery(url.searchParams);
      return {
        statusCode: 200,
        body: knowledgeGraphResponseSchema.parse(
          await store.getKnowledgeGraph({ ...getScopeFilters(url, adminContext), ...query }),
        ),
      };
    },
    async getEvents({ url, adminContext }) {
      const limit = url.searchParams.get('limit');
      const scopeFilters = getScopeFilters(url, adminContext);
      const items = await store.listEvents({
        ...scopeFilters,
        eventType: url.searchParams.get('event_type') ?? undefined,
        limit: hasListQuery(url.searchParams, ['event_type']) ? undefined : limit ? Number(limit) : undefined,
      });

      if (hasListQuery(url.searchParams, ['event_type'])) {
        const query = parseEventListQuery(url.searchParams);
        return {
          statusCode: 200,
          body: eventPageResponseSchema.parse(paginateItems(filterEventPageItems(items, query), query)),
        };
      }

      return {
        statusCode: 200,
        body: eventListResponseSchema.parse({
          items,
        }),
      };
    },
    async getEventsStream({ request, response, url, adminContext }) {
      const scopeFilters = getScopeFilters(url, adminContext);
      const eventType = url.searchParams.get('event_type') ?? undefined;
      let sequence = 0;
      let eventTimer;
      let heartbeatTimer;

      const cleanup = () => {
        clearInterval(eventTimer);
        clearInterval(heartbeatTimer);
        if (!response.writableEnded) {
          response.end();
        }
      };

      const sendSyntheticEvent = async () => {
        if (response.writableEnded || response.destroyed) {
          cleanup();
          return;
        }

        const seedEvents = await store.listEvents({
          ...scopeFilters,
          eventType,
          limit: 12,
        });
        const item = buildSyntheticEvent(seedEvents, sequence);
        response.write(formatSseChunk({ items: [item] }, sequence === 0 ? 1000 : undefined));
        sequence += 1;
      };

      setCorsHeaders(response, config.allowedOrigin);
      response.statusCode = 200;
      response.setHeader('content-type', 'text/event-stream; charset=utf-8');
      response.setHeader('cache-control', 'no-cache, no-transform');
      response.setHeader('connection', 'keep-alive');
      response.flushHeaders?.();
      response.write(formatSseComment('connected'));
      await sendSyntheticEvent();

      eventTimer = setInterval(() => {
        sendSyntheticEvent().catch(() => {
          cleanup();
        });
      }, 3000);
      heartbeatTimer = setInterval(() => {
        if (!response.writableEnded && !response.destroyed) {
          response.write(formatSseComment('keepalive'));
        }
      }, 15000);

      request.once('close', cleanup);
      response.once('close', cleanup);

      return { handled: true };
    },
    async getAnalytics({ url, adminContext }) {
      return {
        statusCode: 200,
        body: analyticsResponseSchema.parse(await store.getAnalytics(getScopeFilters(url, adminContext))),
      };
    },
    async getObservability({ url, adminContext }) {
      const filters = getScopeFilters(url, adminContext);
      const items = await store.getObservability(filters);
      const clientErrors = await store.listClientErrors(filters);

      if (hasListQuery(url.searchParams)) {
        const query = parseObservabilityListQuery(url.searchParams);
        return {
          statusCode: 200,
          body: observabilityPageResponseSchema.parse({
            ...paginateItems(filterObservabilityItems(items, query), query),
            clientErrors: filterClientErrors(clientErrors, query),
          }),
        };
      }

      return {
        statusCode: 200,
        body: observabilityResponseSchema.parse({
          items,
          clientErrors,
        }),
      };
    },
    async getAuditLogs({ url, adminContext }) {
      const items = await store.listAuditLogs(getScopeFilters(url, adminContext));
      if (hasListQuery(url.searchParams, ['actor', 'action', 'resource_type', 'from', 'to'])) {
        const query = parseAuditListQuery(url.searchParams);
        return {
          statusCode: 200,
          body: auditPageResponseSchema.parse(paginateItems(filterAuditPageItems(items, query), query)),
        };
      }

      return {
        statusCode: 200,
        body: auditListResponseSchema.parse({ items }),
      };
    },
    async getSystem() {
      return {
        statusCode: 200,
        body: systemResponseSchema.parse({ sections: await store.getSystem() }),
      };
    },
  };
}
