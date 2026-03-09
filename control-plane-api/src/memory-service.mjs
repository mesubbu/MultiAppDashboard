import { createHash, randomUUID } from 'node:crypto';

import { createEmbeddingsService } from './embeddings-service.mjs';

function hashId(prefix, ...parts) {
  return `${prefix}_${createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16)}`;
}

function slugifyKey(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64);
}

function trimSnippet(value, maxLength = 220) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function formatPreference(pattern) {
  return {
    id: pattern.id,
    key: pattern.signalKey.replace(/^preference\./, ''),
    value: pattern.signalValue,
    sampleCount: pattern.sampleCount,
    updatedAt: pattern.windowEndedAt ?? pattern.createdAt,
  };
}

function formatAgentExperience(pattern) {
  return {
    id: pattern.id,
    agentId: pattern.metadata?.agentId ?? pattern.signalKey.replace(/^agent_experience\./, ''),
    outcome: pattern.signalValue,
    summary: pattern.metadata?.summary ?? 'Recorded agent experience.',
    sampleCount: pattern.sampleCount,
    createdAt: pattern.windowEndedAt ?? pattern.createdAt,
    metadata: pattern.metadata ?? {},
  };
}

function buildMemorySummary(context) {
  const parts = [];
  if (context.preferences.length) parts.push(`${context.preferences.length} operator preference${context.preferences.length === 1 ? '' : 's'}`);
  if (context.conversation.length) parts.push(`${context.conversation.length} prior conversation turn${context.conversation.length === 1 ? '' : 's'}`);
  if (context.items.length) parts.push(`${context.items.length} semantic memory hit${context.items.length === 1 ? '' : 's'}`);
  if (context.agentExperiences.length) parts.push(`${context.agentExperiences.length} agent experience signal${context.agentExperiences.length === 1 ? '' : 's'}`);
  return parts.length ? `Loaded ${parts.join(', ')}.` : '';
}

export function createMemoryService({ store, config = {} }) {
  const embeddingsService = createEmbeddingsService({ store, config });

  return {
    async saveConversationTurn(input, adminContext) {
      const turnId = `turn_${randomUUID()}`;
      const turnCreatedAt = new Date().toISOString();
      const payload = await embeddingsService.embed({
        items: [{
          text: `User: ${input.userMessage}\nAssistant: ${input.assistantMessage}`,
          title: trimSnippet(input.userMessage, 80),
          sourceType: 'query',
          metadata: {
            memoryKind: 'conversation_turn',
            turnId,
            sessionId: input.sessionId,
            pathname: input.pathname,
            userId: adminContext.userId,
            userMessage: input.userMessage,
            assistantMessage: input.assistantMessage,
            toolCalls: input.toolCalls ?? [],
            turnCreatedAt,
          },
        }],
        persist: true,
        chunkSize: 420,
        overlap: 60,
      }, adminContext);

      const document = payload.documents[0];
      return {
        id: turnId,
        documentId: document.id,
        sessionId: input.sessionId,
        tenantId: document.tenantId,
        appId: document.appId,
        userId: adminContext.userId,
        pathname: input.pathname,
        userMessage: input.userMessage,
        assistantMessage: input.assistantMessage,
        toolCalls: input.toolCalls ?? [],
        createdAt: turnCreatedAt,
      };
    },
    async listConversationTurns(input, adminContext) {
      return store.listConversationTurns({
        tenantId: adminContext.tenantId ?? null,
        appId: adminContext.appId ?? null,
        userId: adminContext.userId,
        sessionId: input.sessionId,
        limit: input.limit ?? 10,
      });
    },
    async upsertPreferences(input, adminContext) {
      const now = new Date().toISOString();
      const saved = [];
      for (const preference of input.items) {
        const normalizedKey = slugifyKey(preference.key);
        const pattern = await store.saveUsagePattern({
          id: hashId('pref', adminContext.tenantId ?? '', adminContext.appId ?? '', adminContext.userId, normalizedKey),
          tenantId: adminContext.tenantId ?? null,
          appId: adminContext.appId ?? null,
          scope: 'operator',
          signalKey: `preference.${normalizedKey}`,
          signalValue: preference.value,
          metadata: { userId: adminContext.userId, key: normalizedKey },
          sampleCount: 1,
          windowStartedAt: now,
          windowEndedAt: now,
        });
        saved.push(formatPreference(pattern));
      }
      return saved;
    },
    async listPreferences(adminContext) {
      const patterns = await store.listUsagePatterns({
        tenantId: adminContext.tenantId ?? null,
        appId: adminContext.appId ?? null,
        scope: 'operator',
        userId: adminContext.userId,
        signalKeyPrefix: 'preference.',
        limit: 10,
      });
      return patterns.map(formatPreference);
    },
    async recordAgentExperience(input, adminContext) {
      const now = new Date().toISOString();
      const pattern = await store.saveUsagePattern({
        id: hashId('agentxp', adminContext.tenantId ?? '', adminContext.appId ?? '', input.agentId, input.summary),
        tenantId: adminContext.tenantId ?? null,
        appId: adminContext.appId ?? null,
        scope: 'agent',
        signalKey: `agent_experience.${slugifyKey(input.agentId)}`,
        signalValue: input.outcome,
        metadata: { ...input.metadata, agentId: input.agentId, summary: input.summary },
        sampleCount: 1,
        windowStartedAt: now,
        windowEndedAt: now,
      });
      return formatAgentExperience(pattern);
    },
    async retrieveContext(input, adminContext) {
      const [queryEmbedding, preferences, conversation, patterns] = await Promise.all([
        embeddingsService.embed({
          items: [{ text: input.query, sourceType: 'query', metadata: { memoryKind: 'retrieval_query' } }],
          persist: false,
          chunkSize: Math.min(420, Math.max(120, input.query.length + 20)),
          overlap: 0,
        }, adminContext),
        this.listPreferences(adminContext),
        this.listConversationTurns({ sessionId: input.sessionId, limit: input.conversationLimit ?? 3 }, adminContext),
        store.listUsagePatterns({
          tenantId: adminContext.tenantId ?? null,
          appId: adminContext.appId ?? null,
          scope: 'agent',
          signalKeyPrefix: 'agent_experience.',
          limit: 3,
        }),
      ]);

      const vector = queryEmbedding.embeddings[0]?.embeddingVector ?? [];
      const matches = vector.length
        ? await store.searchEmbeddings({
            tenantId: adminContext.tenantId ?? null,
            appId: adminContext.appId ?? null,
            vector,
            limit: input.limit ?? 4,
            sourceTypes: ['query', 'research_note', 'event', 'agent_note', 'document'],
          })
        : [];

      const items = matches.map((item) => ({
        id: item.id,
        documentId: item.documentId,
        sourceType: item.sourceType,
        title: item.title,
        snippet: trimSnippet(item.snippet),
        score: Number(item.score.toFixed(4)),
        metadata: item.metadata ?? {},
        createdAt: item.createdAt,
      }));

      const context = {
        summary: '',
        items,
        preferences,
        conversation,
        agentExperiences: patterns.map(formatAgentExperience),
      };
      context.summary = buildMemorySummary(context);
      return context;
    },
  };
}