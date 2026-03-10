import { createHash, randomUUID } from 'node:crypto';

function inferTitle(item, index) {
  if (item.title) return item.title;
  return `${item.sourceType.replaceAll('_', ' ')} ${index + 1}`.replace(/^./, (value) => value.toUpperCase());
}

function computeChecksum(text) {
  return createHash('sha256').update(text).digest('hex');
}

function tokenize(text) {
  return text.toLowerCase().split(/[^a-z0-9]+/i).map((token) => token.trim()).filter(Boolean);
}

function normalizeVector(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) return vector;
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

function buildDeterministicVector(text, dimensions) {
  const vector = Array.from({ length: dimensions }, () => 0);
  const tokens = tokenize(text);
  for (const token of tokens) {
    const digest = createHash('sha256').update(token).digest();
    for (let index = 0; index < 6; index += 1) {
      const offset = index * 4;
      const position = digest.readUInt32BE(offset) % dimensions;
      const sign = digest[offset] % 2 === 0 ? 1 : -1;
      const weight = 1 + (digest[offset + 1] % 7) / 10;
      vector[position] += sign * weight;
    }
  }
  return normalizeVector(vector);
}

function chunkText(text, chunkSize, overlap) {
  if (text.length <= chunkSize) return [text.trim()];
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  let current = [];
  let currentLength = 0;

  for (const word of words) {
    const nextLength = currentLength ? currentLength + word.length + 1 : word.length;
    if (current.length && nextLength > chunkSize) {
      chunks.push(current.join(' '));
      const overlapWords = [];
      let overlapLength = 0;
      for (let index = current.length - 1; index >= 0; index -= 1) {
        const candidate = current[index];
        const projected = overlapLength ? overlapLength + candidate.length + 1 : candidate.length;
        if (projected > overlap) break;
        overlapWords.unshift(candidate);
        overlapLength = projected;
      }
      current = overlapWords;
      currentLength = current.join(' ').length;
    }
    current.push(word);
    currentLength = current.join(' ').length;
  }

  if (current.length) chunks.push(current.join(' '));
  return chunks.map((item) => item.trim()).filter(Boolean);
}

function buildProvider(config, requestedModel) {
  const model = requestedModel ?? config.embeddingModel ?? 'bge-small-en-v1.5';
  const remoteEnabled = config.embeddingProvider === 'ollama' && Boolean(config.embeddingApiUrl);
  return {
    name: remoteEnabled ? 'ollama' : 'local-hash',
    model,
    dimensions: config.embeddingDimensions ?? 1536,
    remoteEnabled,
  };
}

async function maybeEmbedWithRemote(provider, texts, config) {
  if (!provider.remoteEnabled) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.embeddingTimeoutMs ?? 4000);
  try {
    const response = await fetch(new URL('/api/embed', config.embeddingApiUrl).toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: provider.model, input: texts, truncate: false }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Remote embedding provider failed with status ${response.status}.`);
    const payload = await response.json().catch(() => null);
    const embeddings = payload?.embeddings;
    if (!Array.isArray(embeddings) || embeddings.some((item) => !Array.isArray(item))) {
      throw new Error('Remote embedding provider returned an invalid response.');
    }
    return embeddings.map((vector) => normalizeVector(vector.slice(0, provider.dimensions).concat(Array.from({ length: Math.max(0, provider.dimensions - vector.length) }, () => 0))));
  } finally {
    clearTimeout(timeout);
  }
}

function buildDocumentsAndChunks(input, provider) {
  const documents = [];
  const chunkRecords = [];
  input.items.forEach((item, itemIndex) => {
    const title = inferTitle(item, itemIndex);
    const checksum = computeChecksum(item.text);
    const documentId = `doc_${randomUUID()}`;
    const chunks = chunkText(item.text, input.chunkSize, input.overlap);
    const metadata = { ...item.metadata, sourceType: item.sourceType };
    documents.push({
      id: documentId,
      tenantId: null,
      appId: null,
      sourceType: item.sourceType,
      sourceUri: item.sourceUri ?? '',
      title,
      checksum,
      metadata,
      chunkCount: chunks.length,
      contentText: item.text,
    });
    chunks.forEach((chunkText, chunkIndex) => {
      chunkRecords.push({
        id: `emb_${randomUUID()}`,
        documentId,
        chunkIndex,
        chunkText,
        embeddingModel: provider.model,
        embeddingDimensions: provider.dimensions,
        metadata,
      });
    });
  });
  return { documents, chunkRecords };
}

export function createEmbeddingsService({ store, config = {} }) {
  function cosineSimilarity(vectorA, vectorB) {
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < vectorA.length; i += 1) {
      dot += vectorA[i] * vectorB[i];
      magA += vectorA[i] * vectorA[i];
      magB += vectorB[i] * vectorB[i];
    }
    const denominator = Math.sqrt(magA) * Math.sqrt(magB);
    return denominator === 0 ? 0 : dot / denominator;
  }

  async function generateQueryVector(text) {
    const provider = buildProvider(config);
    let vector;
    try {
      const remoteResult = await maybeEmbedWithRemote(provider, [text], config);
      vector = remoteResult ? remoteResult[0] : buildDeterministicVector(text, provider.dimensions);
    } catch {
      vector = buildDeterministicVector(text, provider.dimensions);
    }
    return { vector, provider };
  }

  return {
    async embed(input, adminContext) {
      const provider = buildProvider(config, input.model);
      const { documents, chunkRecords } = buildDocumentsAndChunks(input, provider);
      const chunkTexts = chunkRecords.map((item) => item.chunkText);
      let degraded = false;
      let vectors;

      try {
        vectors = (await maybeEmbedWithRemote(provider, chunkTexts, config)) ?? chunkTexts.map((text) => buildDeterministicVector(text, provider.dimensions));
      } catch {
        degraded = provider.remoteEnabled;
        vectors = chunkTexts.map((text) => buildDeterministicVector(text, provider.dimensions));
      }

      const embeddings = chunkRecords.map((item, index) => ({ ...item, embeddingVector: vectors[index] }));
      const scopedDocuments = documents.map((item) => ({ ...item, tenantId: adminContext.tenantId ?? null, appId: adminContext.appId ?? null }));
      const persistedPayload = input.persist === false
        ? { documents: scopedDocuments, embeddings }
        : await store.saveEmbeddings({
            tenantId: adminContext.tenantId ?? null,
            appId: adminContext.appId ?? null,
            documents: scopedDocuments,
            embeddings,
          });

      return {
        provider,
        persisted: input.persist !== false,
        documents: persistedPayload.documents.map((item) => ({
          id: item.id,
          tenantId: item.tenantId,
          appId: item.appId,
          sourceType: item.sourceType,
          sourceUri: item.sourceUri,
          title: item.title,
          checksum: item.checksum,
          chunkCount: item.chunkCount,
          metadata: item.metadata,
        })),
        embeddings: persistedPayload.embeddings,
        stats: {
          documentsCreated: persistedPayload.documents.length,
          embeddingsCreated: persistedPayload.embeddings.length,
          totalCharacters: input.items.reduce((sum, item) => sum + item.text.length, 0),
          totalChunks: persistedPayload.embeddings.length,
        },
        degraded,
      };
    },

    async retrieveContext(query, { topK = 5, sourceType } = {}) {
      const { vector: queryVector } = await generateQueryVector(query);
      const allEmbeddings = await store.listEmbeddings({ sourceType });

      const scored = allEmbeddings
        .filter((emb) => Array.isArray(emb.embeddingVector) && emb.embeddingVector.length > 0)
        .map((emb) => ({
          ...emb,
          score: cosineSimilarity(queryVector, emb.embeddingVector),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      return scored.map((item) => ({
        id: item.id,
        documentId: item.documentId,
        sourceType: item.metadata?.sourceType ?? 'unknown',
        title: item.metadata?.title ?? item.documentId,
        snippet: item.chunkText?.slice(0, 400) ?? '',
        score: Number(item.score.toFixed(4)),
        metadata: item.metadata ?? {},
        createdAt: item.createdAt ?? new Date().toISOString(),
      }));
    },

    async embedKnowledgeDocs(filePaths, adminContext) {
      const { readFile } = await import('node:fs/promises');
      const results = [];
      const provider = buildProvider(config);

      for (const filePath of filePaths) {
        try {
          const text = await readFile(filePath, 'utf-8');
          const checksum = computeChecksum(text);
          const existingDocs = await store.listDocuments({ sourceType: 'knowledge_doc', sourceUri: filePath });
          const alreadyEmbedded = existingDocs.some((doc) => doc.checksum === checksum);
          if (alreadyEmbedded) {
            results.push({ filePath, status: 'skipped', reason: 'checksum unchanged' });
            continue;
          }
          const fileName = filePath.split('/').pop() ?? filePath;
          const embedResult = await this.embed({
            items: [{ text, sourceType: 'knowledge_doc', sourceUri: filePath, title: fileName }],
            chunkSize: 800,
            overlap: 100,
            persist: true,
          }, adminContext);
          results.push({ filePath, status: 'embedded', stats: embedResult.stats, provider: provider.name });
        } catch (error) {
          results.push({ filePath, status: 'failed', error: error.message });
        }
      }

      return { results, totalFiles: filePaths.length, embedded: results.filter((r) => r.status === 'embedded').length };
    },
  };
}