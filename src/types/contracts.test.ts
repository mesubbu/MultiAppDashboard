import { describe, expect, it } from 'vitest';

import {
  agentsData,
  analyticsData,
  graphEdgesData,
  graphNodesData,
  overviewData,
  tenantsData,
} from '@/mocks/platform-data';
import {
  agentActionRequestSchema,
  agentListResponseSchema,
  aiGatewayResponseSchema,
  analyticsResponseSchema,
  auditRecordSchema,
  embedResponseSchema,
  knowledgeGraphResponseSchema,
  memoryConversationListResponseSchema,
  memoryPreferenceListResponseSchema,
  memoryRetrieveResponseSchema,
  overviewResponseSchema,
  orchestratorWorkflowMutationResponseSchema,
  orchestratorWorkflowRecordSchema,
  insightAgentExecuteResponseSchema,
  insightAgentRunRecordSchema,
  marketSignalListResponseSchema,
  marketSignalRecordSchema,
  recommendationAgentExecuteResponseSchema,
  recommendationAgentRunRecordSchema,
  recommendationListResponseSchema,
  recommendationRecordSchema,
  agentOutcomeMutationResponseSchema,
  agentPerformanceListResponseSchema,
  researchAgentExecuteResponseSchema,
  researchAgentRunRecordSchema,
  researchAgentTriggerMutationResponseSchema,
  researchCollectResponseSchema,
  researchRunRecordSchema,
  researchScheduleMutationResponseSchema,
  reasoningEngineResponseSchema,
  tenantListResponseSchema,
  toolExecuteResponseSchema,
  toolListResponseSchema,
} from '@/types/contracts';

describe('contract schemas', () => {
  it('parses overview payloads', () => {
    expect(overviewResponseSchema.parse(overviewData).queueBacklog).toBe(482);
  });

  it('parses tenant list payloads', () => {
    expect(tenantListResponseSchema.parse({ items: tenantsData }).items).toHaveLength(3);
  });

  it('parses analytics payloads', () => {
    expect(analyticsResponseSchema.parse(analyticsData).kpis[0]?.label).toBe(
      'Gross platform volume',
    );
  });

  it('parses rich agent payloads', () => {
    const parsed = agentListResponseSchema.parse({ items: agentsData }).items[0];
    expect(parsed?.tasks.length).toBe(3);
    expect(parsed?.orchestration.stage).toBe('reason');
  });

  it('parses knowledge graph payloads', () => {
    expect(
      knowledgeGraphResponseSchema.parse({
        nodes: graphNodesData,
        edges: graphEdgesData,
      }).nodes[0]?.tags[0],
    ).toBe('buyer');
  });

  it('parses move-stage agent actions', () => {
    expect(
      agentActionRequestSchema.parse({
        action: 'move_stage',
        stage: 'act',
        lane: 'Tool execution',
        currentStage: 'reason',
        dependencyState: 'ready',
      }).stage,
    ).toBe('act');
  });

  it('parses queue retry and unblock actions', () => {
    expect(agentActionRequestSchema.parse({ action: 'retry_queue' }).action).toBe('retry_queue');
    expect(agentActionRequestSchema.parse({ action: 'unblock' }).action).toBe('unblock');
  });

  it('parses structured audit records', () => {
    expect(
      auditRecordSchema.parse({
        id: 'audit_1',
        actor: 'usr_platform_admin',
        actorDisplay: 'Rhea Sharma',
        action: 'reroute',
        resourceType: 'agent',
        resourceId: 'agent_growth_01',
        timestamp: '2026-03-08T14:10:00.000Z',
        summary: 'Rerouted agent to review · Human review',
      }).action,
    ).toBe('reroute');
  });

  it('parses orchestrator workflow payloads', () => {
    expect(orchestratorWorkflowRecordSchema.parse({
      id: 'workflow_1',
      tenantId: 'tenant_acme',
      appId: 'app_market_web',
      title: 'Coordinate growth workflow',
      summary: 'Distribute planning work across agents.',
      status: 'running',
      priority: 'high',
      owner: 'usr_platform_owner',
      stage: 'reason',
      lane: 'Demand reasoning',
      participants: [{ agentId: 'agent_growth_01', taskId: 'task_1', executionId: 'exec_1', status: 'running', updatedAt: '2026-03-09T10:00:00.000Z' }],
      recommendations: [],
      metadata: { source: 'contract-test' },
      createdAt: '2026-03-09T10:00:00.000Z',
      updatedAt: '2026-03-09T10:01:00.000Z',
    }).participants[0]?.agentId).toBe('agent_growth_01');

    expect(orchestratorWorkflowMutationResponseSchema.parse({
      item: {
        id: 'workflow_1',
        tenantId: 'tenant_acme',
        appId: 'app_market_web',
        title: 'Coordinate growth workflow',
        summary: 'Distribute planning work across agents.',
        status: 'completed',
        priority: 'high',
        owner: 'usr_platform_owner',
        stage: 'reason',
        lane: 'Demand reasoning',
        participants: [{ agentId: 'agent_growth_01', taskId: 'task_1', executionId: 'exec_1', status: 'completed', updatedAt: '2026-03-09T10:05:00.000Z' }],
        aggregationSummary: 'Merged planning outputs.',
        outcome: 'success',
        recommendations: ['Publish summary'],
        metadata: {},
        createdAt: '2026-03-09T10:00:00.000Z',
        updatedAt: '2026-03-09T10:05:00.000Z',
        completedAt: '2026-03-09T10:05:00.000Z',
      },
      agents: [agentsData[0]],
      audit: {
        id: 'audit_2',
        actor: 'usr_platform_owner',
        action: 'orchestrator_aggregate',
        resourceType: 'workflow',
        resourceId: 'workflow_1',
        timestamp: '2026-03-09T10:05:00.000Z',
      },
    }).item.outcome).toBe('success');
  });

  it('parses research run and schedule payloads', () => {
    expect(researchRunRecordSchema.parse({
      id: 'research_run_1',
      tenantId: 'tenant_acme',
      appId: 'app_market_web',
      source: 'market_api',
      query: 'NVDA AMD',
      status: 'completed',
      provider: 'market-snapshot-adapter/local-hash',
      degraded: false,
      summary: '2 research item(s) collected for NVDA AMD.',
      documentsCreated: 2,
      embeddingsCreated: 2,
      itemsCollected: 2,
      metadata: { persisted: true },
      createdAt: '2026-03-09T10:06:00.000Z',
    }).source).toBe('market_api');

    expect(researchCollectResponseSchema.parse({
      item: {
        id: 'research_run_1',
        tenantId: 'tenant_acme',
        appId: 'app_market_web',
        source: 'platform_activity',
        query: 'agent backlog',
        status: 'degraded',
        provider: 'platform-activity-adapter/local-hash',
        degraded: true,
        summary: '1 research item(s) collected for agent backlog.',
        documentsCreated: 1,
        embeddingsCreated: 1,
        itemsCollected: 1,
        metadata: {},
        createdAt: '2026-03-09T10:07:00.000Z',
      },
      audit: {
        id: 'audit_3',
        actor: 'usr_platform_owner',
        action: 'research_collect',
        resourceType: 'research',
        resourceId: 'research_run_1',
        timestamp: '2026-03-09T10:07:00.000Z',
      },
    }).item.status).toBe('degraded');

    expect(researchScheduleMutationResponseSchema.parse({
      item: {
        id: 'research_schedule_1',
        tenantId: 'tenant_acme',
        appId: 'app_market_web',
        name: 'Finance scan',
        source: 'rss',
        query: 'finance',
        intervalMinutes: 60,
        limit: 3,
        persist: true,
        status: 'active',
        nextRunAt: '2026-03-09T11:00:00.000Z',
        metadata: {},
        createdAt: '2026-03-09T10:00:00.000Z',
        updatedAt: '2026-03-09T10:00:00.000Z',
      },
      audit: {
        id: 'audit_4',
        actor: 'usr_platform_owner',
        action: 'research_schedule_create',
        resourceType: 'research',
        resourceId: 'research_schedule_1',
        timestamp: '2026-03-09T10:00:00.000Z',
      },
    }).item.status).toBe('active');

    expect(researchAgentRunRecordSchema.parse({
      id: 'research_agent_run_1',
      agentId: 'agent_growth_01',
      tenantId: 'tenant_acme',
      appId: 'app_market_web',
      researchRunId: 'research_run_1',
      trigger: 'event',
      triggerId: 'research_agent_trigger_1',
      eventId: 'evt_1001',
      source: 'platform_activity',
      query: 'listing demand follow-up',
      status: 'completed',
      taskId: 'task_1',
      executionId: 'exec_1',
      summary: '1 research item(s) collected for listing demand follow-up.',
      documentsCreated: 1,
      embeddingsCreated: 1,
      metadata: { provider: 'platform-activity-adapter/local-hash' },
      createdAt: '2026-03-09T10:10:00.000Z',
    }).trigger).toBe('event');

    expect(researchAgentExecuteResponseSchema.parse({
      item: {
        id: 'research_agent_run_1',
        agentId: 'agent_growth_01',
        tenantId: 'tenant_acme',
        appId: 'app_market_web',
        researchRunId: 'research_run_1',
        trigger: 'manual',
        source: 'market_api',
        query: 'NVDA AMD',
        status: 'completed',
        taskId: 'task_1',
        executionId: 'exec_1',
        summary: '2 research item(s) collected for NVDA AMD.',
        documentsCreated: 2,
        embeddingsCreated: 2,
        metadata: {},
        createdAt: '2026-03-09T10:11:00.000Z',
      },
      agent: agentsData[0],
      researchRun: {
        id: 'research_run_1',
        tenantId: 'tenant_acme',
        appId: 'app_market_web',
        source: 'market_api',
        query: 'NVDA AMD',
        status: 'completed',
        provider: 'market-snapshot-adapter/local-hash',
        degraded: false,
        summary: '2 research item(s) collected for NVDA AMD.',
        documentsCreated: 2,
        embeddingsCreated: 2,
        itemsCollected: 2,
        metadata: {},
        createdAt: '2026-03-09T10:11:00.000Z',
      },
      audit: {
        id: 'audit_5',
        actor: 'usr_platform_owner',
        action: 'research_agent_execute',
        resourceType: 'research',
        resourceId: 'research_agent_run_1',
        timestamp: '2026-03-09T10:11:00.000Z',
      },
    }).item.trigger).toBe('manual');

    expect(researchAgentTriggerMutationResponseSchema.parse({
      item: {
        id: 'research_agent_trigger_1',
        agentId: 'agent_growth_01',
        tenantId: 'tenant_acme',
        appId: 'app_market_web',
        name: 'Listing follow-up',
        triggerType: 'event',
        source: 'platform_activity',
        query: 'listing demand follow-up',
        eventTypes: ['listing_created'],
        limit: 1,
        persist: true,
        status: 'active',
        metadata: {},
        createdAt: '2026-03-09T10:12:00.000Z',
        updatedAt: '2026-03-09T10:12:00.000Z',
      },
      audit: {
        id: 'audit_6',
        actor: 'usr_platform_owner',
        action: 'research_agent_trigger_create',
        resourceType: 'research',
        resourceId: 'research_agent_trigger_1',
        timestamp: '2026-03-09T10:12:00.000Z',
      },
    }).item.triggerType).toBe('event');

    expect(marketSignalRecordSchema.parse({
      id: 'signal_1',
      tenantId: 'tenant_nova',
      appId: 'app_admin',
      signalType: 'conversion_momentum',
      subject: 'Large enterprise order placed for premium inventory.',
      direction: 'up',
      strength: 0.82,
      confidence: 0.87,
      summary: 'Large enterprise order placed for premium inventory. This pattern maps to conversion momentum.',
      metadata: { eventIds: ['evt_order_1'] },
      detectedAt: '2026-03-09T10:13:00.000Z',
    }).signalType).toBe('conversion_momentum');

    expect(insightAgentRunRecordSchema.parse({
      id: 'insight_run_1',
      agentId: 'agent_finance_03',
      tenantId: 'tenant_nova',
      appId: 'app_admin',
      trigger: 'event',
      status: 'completed',
      taskId: 'task_1',
      executionId: 'exec_1',
      summary: '2 market signal(s) detected across recent platform activity.',
      signalCount: 2,
      marketSignalIds: ['signal_1', 'signal_2'],
      eventCount: 2,
      usagePatternCount: 1,
      researchRunCount: 1,
      metadata: { processedEventIds: ['evt_order_1', 'evt_message_1'] },
      createdAt: '2026-03-09T10:13:00.000Z',
    }).trigger).toBe('event');

    expect(insightAgentExecuteResponseSchema.parse({
      item: {
        id: 'insight_run_1',
        agentId: 'agent_finance_03',
        tenantId: 'tenant_nova',
        appId: 'app_admin',
        trigger: 'manual',
        status: 'completed',
        taskId: 'task_1',
        executionId: 'exec_1',
        summary: '2 market signal(s) detected across recent platform activity.',
        signalCount: 2,
        marketSignalIds: ['signal_1', 'signal_2'],
        eventCount: 2,
        usagePatternCount: 1,
        researchRunCount: 1,
        metadata: {},
        createdAt: '2026-03-09T10:13:00.000Z',
      },
      agent: agentsData[2],
      signals: [{
        id: 'signal_1',
        tenantId: 'tenant_nova',
        appId: 'app_admin',
        signalType: 'conversion_momentum',
        subject: 'Large enterprise order placed for premium inventory.',
        direction: 'up',
        strength: 0.82,
        confidence: 0.87,
        summary: 'Large enterprise order placed for premium inventory. This pattern maps to conversion momentum.',
        metadata: { eventIds: ['evt_order_1'] },
        detectedAt: '2026-03-09T10:13:00.000Z',
      }],
      audit: {
        id: 'audit_7',
        actor: 'usr_platform_owner',
        action: 'insight_agent_execute',
        resourceType: 'agent',
        resourceId: 'agent_finance_03',
        timestamp: '2026-03-09T10:13:00.000Z',
      },
    }).item.trigger).toBe('manual');

    expect(marketSignalListResponseSchema.parse({
      items: [{
        id: 'signal_1',
        tenantId: 'tenant_nova',
        appId: 'app_admin',
        signalType: 'conversion_momentum',
        subject: 'Large enterprise order placed for premium inventory.',
        direction: 'up',
        strength: 0.82,
        confidence: 0.87,
        summary: 'Large enterprise order placed for premium inventory. This pattern maps to conversion momentum.',
        metadata: { eventIds: ['evt_order_1'] },
        detectedAt: '2026-03-09T10:13:00.000Z',
      }],
    }).items).toHaveLength(1);

    expect(recommendationRecordSchema.parse({
      id: 'rec_1',
      tenantId: 'tenant_nova',
      appId: 'app_admin',
      agentId: 'agent_finance_03',
      category: 'prioritized_action',
      priority: 'high',
      title: 'Act on premium inventory demand spike',
      summary: 'Recent order momentum indicates a premium inventory opportunity.',
      rationale: ['Demand accelerated in the latest event window.'],
      confidence: 0.83,
      sourceSignalIds: ['signal_1'],
      relatedNodeIds: ['node_1'],
      relatedDocumentIds: ['doc_1'],
      metadata: {},
      createdAt: '2026-03-09T10:20:00.000Z',
    }).priority).toBe('high');

    expect(recommendationAgentRunRecordSchema.parse({
      id: 'recommendation_run_1',
      agentId: 'agent_finance_03',
      tenantId: 'tenant_nova',
      appId: 'app_admin',
      status: 'completed',
      taskId: 'task_1',
      executionId: 'exec_1',
      summary: '2 operator recommendation(s) generated from signals, graph context, and behavior data.',
      recommendationCount: 2,
      signalCount: 2,
      graphContextCount: 3,
      behaviorPatternCount: 1,
      documentMatchCount: 1,
      recommendationIds: ['rec_1', 'rec_2'],
      metadata: {},
      createdAt: '2026-03-09T10:20:00.000Z',
    }).status).toBe('completed');

    expect(recommendationAgentExecuteResponseSchema.parse({
      item: {
        id: 'recommendation_run_1',
        agentId: 'agent_finance_03',
        tenantId: 'tenant_nova',
        appId: 'app_admin',
        status: 'completed',
        taskId: 'task_1',
        executionId: 'exec_1',
        summary: '2 operator recommendation(s) generated from signals, graph context, and behavior data.',
        recommendationCount: 2,
        signalCount: 2,
        graphContextCount: 3,
        behaviorPatternCount: 1,
        documentMatchCount: 1,
        recommendationIds: ['rec_1', 'rec_2'],
        metadata: {},
        createdAt: '2026-03-09T10:20:00.000Z',
      },
      agent: agentsData[2],
      recommendations: [{
        id: 'rec_1',
        tenantId: 'tenant_nova',
        appId: 'app_admin',
        agentId: 'agent_finance_03',
        category: 'prioritized_action',
        priority: 'high',
        title: 'Act on premium inventory demand spike',
        summary: 'Recent order momentum indicates a premium inventory opportunity.',
        rationale: ['Demand accelerated in the latest event window.'],
        confidence: 0.83,
        sourceSignalIds: ['signal_1'],
        relatedNodeIds: ['node_1'],
        relatedDocumentIds: ['doc_1'],
        metadata: {},
        createdAt: '2026-03-09T10:20:00.000Z',
      }],
      audit: {
        id: 'audit_8',
        actor: 'usr_platform_owner',
        action: 'recommendation_agent_execute',
        resourceType: 'recommendation',
        resourceId: 'recommendation_run_1',
        timestamp: '2026-03-09T10:20:00.000Z',
      },
    }).item.recommendationCount).toBe(2);

    expect(recommendationListResponseSchema.parse({
      items: [{
        id: 'rec_1',
        tenantId: 'tenant_nova',
        appId: 'app_admin',
        agentId: 'agent_finance_03',
        category: 'prioritized_action',
        priority: 'high',
        title: 'Act on premium inventory demand spike',
        summary: 'Recent order momentum indicates a premium inventory opportunity.',
        rationale: ['Demand accelerated in the latest event window.'],
        confidence: 0.83,
        sourceSignalIds: ['signal_1'],
        relatedNodeIds: ['node_1'],
        relatedDocumentIds: ['doc_1'],
        metadata: {},
        createdAt: '2026-03-09T10:20:00.000Z',
      }],
    }).items).toHaveLength(1);

    expect(agentOutcomeMutationResponseSchema.parse({
      item: {
        id: 'outcome_1',
        agentId: 'agent_finance_03',
        tenantId: 'tenant_nova',
        appId: 'app_admin',
        source: 'recommendation',
        status: 'success',
        score: 0.9,
        summary: 'Operator accepted the recommendation.',
        relatedRecommendationId: 'rec_1',
        metadata: {},
        createdAt: '2026-03-09T10:25:00.000Z',
      },
      performance: {
        id: 'agent_perf_agent_finance_03',
        agentId: 'agent_finance_03',
        tenantId: 'tenant_nova',
        appId: 'app_admin',
        evaluationWindow: 'rolling_30',
        successRate: 0.8,
        avgLatencyMs: 320,
        avgCostUsd: 0.15,
        taskCount: 5,
        feedbackScore: 0.82,
        improvementDelta: 0.08,
        trend: 'up',
        metadata: {},
        recordedAt: '2026-03-09T10:25:00.000Z',
      },
      audit: {
        id: 'audit_9',
        actor: 'usr_platform_owner',
        action: 'agent_outcome_recorded',
        resourceType: 'agent',
        resourceId: 'agent_finance_03',
        timestamp: '2026-03-09T10:25:00.000Z',
      },
    }).performance.trend).toBe('up');

    expect(agentPerformanceListResponseSchema.parse({
      items: [{
        id: 'agent_perf_agent_finance_03',
        agentId: 'agent_finance_03',
        tenantId: 'tenant_nova',
        appId: 'app_admin',
        evaluationWindow: 'rolling_30',
        successRate: 0.8,
        avgLatencyMs: 320,
        avgCostUsd: 0.15,
        taskCount: 5,
        feedbackScore: 0.82,
        improvementDelta: 0.08,
        trend: 'up',
        metadata: {},
        recordedAt: '2026-03-09T10:25:00.000Z',
      }],
      summary: {
        totalOutcomes: 5,
        averageSuccessRate: 0.8,
        averageFeedbackScore: 0.82,
        improvingAgents: 1,
        topPerformers: [{
          id: 'agent_perf_agent_finance_03',
          agentId: 'agent_finance_03',
          tenantId: 'tenant_nova',
          appId: 'app_admin',
          evaluationWindow: 'rolling_30',
          successRate: 0.8,
          avgLatencyMs: 320,
          avgCostUsd: 0.15,
          taskCount: 5,
          feedbackScore: 0.82,
          improvementDelta: 0.08,
          trend: 'up',
          metadata: {},
          recordedAt: '2026-03-09T10:25:00.000Z',
        }],
      },
    }).summary.improvingAgents).toBe(1);
  });

  it('parses tool registry and execution payloads', () => {
    expect(toolListResponseSchema.parse({
      items: [{
        name: 'statistics.calculate.summary',
        description: 'Compute bounded statistics.',
        schema: ['values:number[]<=500'],
        permissions: ['tools:read'],
        riskLevel: 'low',
        executionMode: 'compute',
        safetyGuards: ['bounded_input_500'],
        usageToday: 500,
        p95Ms: 42,
        errorRate: 0.05,
      }],
    }).items[0]?.executionMode).toBe('compute');

    expect(toolExecuteResponseSchema.parse({
      item: {
        id: 'tool_exec_1',
        tool: 'statistics.calculate.summary',
        actor: 'usr_platform_owner',
        tenantId: 'tenant_acme',
        appId: 'app_market_web',
        status: 'completed',
        riskLevel: 'low',
        executionMode: 'compute',
        permissions: ['tools:read'],
        safetyGuards: ['bounded_input_500'],
        durationMs: 18,
        summary: 'Computed summary statistics for 4 queue_depth.',
        inputPreview: '{"values":[12,18,21,34]}',
        outputPreview: '{"mean":21.25}',
        createdAt: '2026-03-09T10:00:00.000Z',
      },
      result: {
        summary: 'Computed summary statistics for 4 queue_depth.',
        payload: { mean: 21.25, median: 19.5 },
      },
    }).item.tool).toBe('statistics.calculate.summary');
  });

  it('parses AI gateway responses', () => {
    expect(aiGatewayResponseSchema.parse({
      route: 'research',
      promptTemplate: 'supply_gap_research_v1',
      message: {
        id: 'assistant_1',
        role: 'assistant',
        content: 'Research summary',
        createdAt: '2026-03-09T10:00:00.000Z',
        toolCalls: [],
      },
      suggestions: ['Show the hottest category-to-location paths'],
      reasoning: {
        mode: 'summarize',
        intent: 'supply_gaps',
        provider: { name: 'local-rules', model: 'Mistral-7B-Instruct', remoteEnabled: false },
        content: 'Research summary',
        structuredOutput: {
          objective: 'Show supply gaps',
          findings: ['Strongest graph signal found'],
          risks: [],
          actions: [],
        },
        toolCalls: [],
        degraded: false,
      },
      degraded: false,
      guardrails: {
        concurrency: { limit: 2, inFlight: 1 },
        budget: { estimatedUnits: 240, remainingUnits: 2160, windowStartedAt: '2026-03-09T10:00:00.000Z' },
      },
    }).route).toBe('research');
  });

  it('parses reasoning engine responses', () => {
    expect(reasoningEngineResponseSchema.parse({
      mode: 'decide',
      intent: 'overview',
      provider: { name: 'ollama', model: 'llama3.1', remoteEnabled: true },
      content: 'Decision output',
      structuredOutput: {
        objective: 'What should I prioritize?',
        findings: ['Backlog remains elevated'],
        risks: ['Queue latency could rise'],
        actions: [{ title: 'Reduce queue pressure', detail: 'Rebalance the noisiest agents.', priority: 'high' }],
        decision: { recommendation: 'Reduce queue pressure first.', confidence: 0.78, rationale: ['Backlog remains elevated'] },
      },
      toolCalls: [],
      degraded: false,
    }).mode).toBe('decide');
  });

  it('parses embedding responses', () => {
    expect(embedResponseSchema.parse({
      provider: { name: 'local-hash', model: 'bge-small-en-v1.5', dimensions: 32, remoteEnabled: false },
      persisted: true,
      documents: [{
        id: 'doc_1',
        tenantId: 'tenant_acme',
        appId: 'app_market_web',
        sourceType: 'research_note',
        sourceUri: '',
        title: 'Research memo',
        checksum: 'abc123',
        chunkCount: 1,
        metadata: {},
      }],
      embeddings: [{
        id: 'emb_1',
        documentId: 'doc_1',
        chunkIndex: 0,
        chunkText: 'Supply gap research',
        embeddingModel: 'bge-small-en-v1.5',
        embeddingDimensions: 32,
        embeddingVector: Array.from({ length: 32 }, () => 0.03125),
        metadata: {},
      }],
      stats: {
        documentsCreated: 1,
        embeddingsCreated: 1,
        totalCharacters: 19,
        totalChunks: 1,
      },
      degraded: false,
    }).embeddings[0]?.embeddingDimensions).toBe(32);
  });

  it('parses memory retrieval payloads', () => {
    expect(memoryRetrieveResponseSchema.parse({
      summary: 'Loaded memory.',
      items: [{
        id: 'ctx_1',
        documentId: 'doc_1',
        sourceType: 'research_note',
        title: 'Prior demand memo',
        snippet: 'Demand was elevated in Mumbai.',
        score: 0.82,
        metadata: {},
        createdAt: '2026-03-09T10:00:00.000Z',
      }],
      preferences: [{ id: 'pref_1', key: 'response_style', value: 'concise', sampleCount: 2, updatedAt: '2026-03-09T10:00:00.000Z' }],
      conversation: [{
        id: 'turn_1',
        documentId: 'doc_turn_1',
        sessionId: 'assistant-history:owner:platform-root:control-dashboard',
        tenantId: 'platform-root',
        appId: 'control-dashboard',
        userId: 'owner',
        userMessage: 'Show supply gaps',
        assistantMessage: 'The hottest gap is in Mumbai.',
        toolCalls: [],
        createdAt: '2026-03-09T10:00:00.000Z',
      }],
      agentExperiences: [{
        id: 'agentxp_1',
        agentId: 'agent_growth_01',
        outcome: 'success',
        summary: 'Escalated the previous demand spike quickly.',
        sampleCount: 1,
        createdAt: '2026-03-09T10:00:00.000Z',
        metadata: {},
      }],
    }).items[0]?.sourceType).toBe('research_note');
  });

  it('parses memory conversation and preference payloads', () => {
    expect(memoryConversationListResponseSchema.parse({
      items: [{
        id: 'turn_1',
        documentId: 'doc_turn_1',
        sessionId: 'assistant-history:owner:platform-root:control-dashboard',
        tenantId: 'platform-root',
        appId: 'control-dashboard',
        userId: 'owner',
        pathname: '/knowledge-graph',
        userMessage: 'Show supply gaps',
        assistantMessage: 'Here are the gaps.',
        toolCalls: [],
        createdAt: '2026-03-09T10:00:00.000Z',
      }],
    }).items).toHaveLength(1);

    expect(memoryPreferenceListResponseSchema.parse({
      items: [{ id: 'pref_1', key: 'response_format', value: 'bullets', sampleCount: 1, updatedAt: '2026-03-09T10:00:00.000Z' }],
    }).items[0]?.key).toBe('response_format');
  });
});
