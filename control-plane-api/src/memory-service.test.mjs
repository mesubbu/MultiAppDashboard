import { describe, expect, it } from 'vitest';

import { createMemoryService } from './memory-service.mjs';
import { createControlPlaneStore } from './store.mjs';

const adminContext = {
  tenantId: 'tenant_acme',
  appId: 'app_market_web',
  userId: 'usr_platform_owner',
  roles: ['platform_owner'],
};

describe('memory service', () => {
  it('stores preferences, agent experience, and conversation turns for semantic retrieval', async () => {
    const service = createMemoryService({ store: createControlPlaneStore(), config: { embeddingDimensions: 48 } });

    await service.upsertPreferences({ items: [{ key: 'response_style', value: 'concise' }] }, adminContext);
    await service.recordAgentExperience({ agentId: 'agent_growth_01', outcome: 'success', summary: 'Escalated the previous Mumbai supply gap quickly.', metadata: { route: 'growth' } }, adminContext);
    await service.saveConversationTurn({
      sessionId: 'assistant-history:usr_platform_owner:tenant_acme:app_market_web',
      pathname: '/knowledge-graph',
      userMessage: 'What did we say about Mumbai supply gaps?',
      assistantMessage: 'We identified a premium tractor demand imbalance in Mumbai.',
      toolCalls: [],
    }, adminContext);

    const context = await service.retrieveContext({
      query: 'Remind me about the Mumbai supply gap.',
      sessionId: 'assistant-history:usr_platform_owner:tenant_acme:app_market_web',
      limit: 4,
      conversationLimit: 3,
    }, adminContext);

    expect(context.preferences).toEqual([expect.objectContaining({ key: 'response_style', value: 'concise' })]);
    expect(context.conversation).toEqual([expect.objectContaining({ userMessage: 'What did we say about Mumbai supply gaps?' })]);
    expect(context.agentExperiences).toEqual([expect.objectContaining({ agentId: 'agent_growth_01', outcome: 'success' })]);
    expect(context.items[0]).toEqual(expect.objectContaining({ sourceType: 'query' }));
    expect(context.summary).toContain('operator preference');
  });
});