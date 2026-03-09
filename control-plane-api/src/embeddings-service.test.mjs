import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEmbeddingsService } from './embeddings-service.mjs';

const adminContext = {
  tenantId: 'tenant_acme',
  appId: 'app_market_web',
  userId: 'usr_platform_owner',
  roles: ['platform_owner'],
};

function createStore(overrides = {}) {
  return {
    saveEmbeddings: async ({ documents, embeddings }) => ({ documents, embeddings }),
    ...overrides,
  };
}

describe('embeddings service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates deterministic vectors and chunked embeddings', async () => {
    const service = createEmbeddingsService({ store: createStore(), config: { embeddingDimensions: 64 } });

    const result = await service.embed({
      items: [
        { text: 'alpha beta gamma '.repeat(80), sourceType: 'document' },
        { text: 'alpha beta gamma '.repeat(80), sourceType: 'document' },
      ],
      persist: false,
      chunkSize: 120,
      overlap: 20,
    }, adminContext);

    expect(result.provider.name).toBe('local-hash');
    expect(result.persisted).toBe(false);
    expect(result.embeddings.length).toBeGreaterThan(2);
    expect(result.embeddings[0]?.embeddingDimensions).toBe(64);
    expect(result.embeddings[0]?.embeddingVector).toEqual(result.embeddings[result.documents[0].chunkCount]?.embeddingVector);
  });

  it('persists generated documents and embeddings through the store', async () => {
    const saveEmbeddings = vi.fn(async ({ documents, embeddings }) => ({ documents, embeddings }));
    const service = createEmbeddingsService({ store: createStore({ saveEmbeddings }), config: { embeddingDimensions: 32 } });

    const result = await service.embed({
      items: [{ text: 'Supply gap research', title: 'Research memo', sourceType: 'research_note', metadata: { topic: 'supply-gap' } }],
      persist: true,
      chunkSize: 200,
      overlap: 20,
    }, adminContext);

    expect(saveEmbeddings).toHaveBeenCalledTimes(1);
    expect(result.documents[0]).toMatchObject({ title: 'Research memo', tenantId: 'tenant_acme', appId: 'app_market_web' });
  });

  it('falls back to the deterministic local provider when the remote provider fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('embedding provider offline')));
    const service = createEmbeddingsService({
      store: createStore(),
      config: { embeddingProvider: 'ollama', embeddingApiUrl: 'http://ollama.local', embeddingModel: 'gte-small', embeddingDimensions: 24 },
    });

    const result = await service.embed({
      items: [{ text: 'hello world', sourceType: 'inline' }],
      persist: false,
      chunkSize: 200,
      overlap: 20,
    }, adminContext);

    expect(result.provider.name).toBe('ollama');
    expect(result.degraded).toBe(true);
    expect(result.embeddings[0]?.embeddingVector).toHaveLength(24);
  });
});