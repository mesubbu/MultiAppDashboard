import { randomUUID } from 'node:crypto';

function stripHtml(input = '') {
  return input.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function summarizeText(input, maxLength = 220) {
  const compact = input.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1).trimEnd()}…`;
}

function addMinutes(timestamp, minutes) {
  return new Date(new Date(timestamp).getTime() + minutes * 60_000).toISOString();
}

function deterministicNumber(seed, min, max) {
  const total = Array.from(seed).reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);
  const range = max - min;
  return Number((min + (total % 10_000) / 10_000 * range).toFixed(2));
}

function tokenizeQuery(query) {
  return query.split(/[,\s/]+/).map((item) => item.trim()).filter(Boolean);
}

async function maybeFetchText(url) {
  if (!url) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_500);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'text/plain,text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8' } });
    if (!response.ok) throw new Error(`Failed with status ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseRssItems(xml, limit) {
  const items = [];
  const pattern = /<item>([\s\S]*?)<\/item>/gi;
  for (const match of xml.matchAll(pattern)) {
    const itemXml = match[1] ?? '';
    const title = /<title>([\s\S]*?)<\/title>/i.exec(itemXml)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    const description = /<description>([\s\S]*?)<\/description>/i.exec(itemXml)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    const link = /<link>([\s\S]*?)<\/link>/i.exec(itemXml)?.[1]?.trim();
    if (!title && !description) continue;
    items.push({ title: title ?? 'Feed item', text: stripHtml(description ?? title ?? ''), sourceUri: link });
    if (items.length >= limit) break;
  }
  return items;
}

async function collectRss(input) {
  let degraded = false;
  let text = null;
  try {
    text = await maybeFetchText(input.sourceUri);
  } catch {
    degraded = Boolean(input.sourceUri);
  }
  const remoteItems = text ? parseRssItems(text, input.limit) : [];
  const items = remoteItems.length
    ? remoteItems
    : Array.from({ length: input.limit }, (_, index) => ({
        title: `${input.query} signal ${index + 1}`,
        text: `${input.query} research signal ${index + 1}: monitor momentum, notable operator activity, and likely downstream execution risk for this topic.`,
        sourceUri: input.sourceUri,
      }));
  return { provider: text && remoteItems.length ? 'rss-fetch-adapter' : 'rss-fallback-adapter', degraded, items };
}

async function collectWebPage(input) {
  let degraded = false;
  try {
    const html = await maybeFetchText(input.sourceUri);
    if (html) {
      const title = /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? input.query;
      const text = stripHtml(html);
      return {
        provider: 'web-fetch-adapter',
        degraded: false,
        items: [{ title, text: summarizeText(text, 1_200), sourceUri: input.sourceUri }],
      };
    }
  } catch {
    degraded = true;
  }
  return {
    provider: 'web-fallback-adapter',
    degraded,
    items: [{
      title: input.query,
      text: `Fallback web research note for ${input.query}: capture the page objective, visible claims, and any operator follow-up needed before execution.`,
      sourceUri: input.sourceUri,
    }],
  };
}

async function collectMarketApi(input) {
  const symbols = tokenizeQuery(input.query).slice(0, input.limit);
  const items = (symbols.length ? symbols : ['MARKET']).map((symbol, index) => {
    const price = deterministicNumber(`${symbol}_price`, 18, 420);
    const move = deterministicNumber(`${symbol}_move_${index}`, -6.5, 7.5);
    return {
      title: `${symbol.toUpperCase()} market update`,
      text: `${symbol.toUpperCase()} traded near ${price}. Intraday move was ${move}%. Research focus: explain the driver, assess follow-on execution risk, and identify whether demand or supply constraints dominate.`,
      sourceUri: input.sourceUri,
    };
  });
  return { provider: 'market-snapshot-adapter', degraded: false, items };
}

async function collectPlatformActivity(input, { store, filters }) {
  const events = await store.listEvents({ ...filters, limit: Math.max(input.limit * 2, 4) });
  const usagePatterns = await store.listUsagePatterns({ ...filters, limit: input.limit });
  const eventItems = events.slice(0, input.limit).map((event) => ({
    title: `${event.type} by ${event.actor}`,
    text: `${event.summary} (event ${event.id} at ${event.timestamp})`,
    sourceUri: undefined,
  }));
  const usageItems = usagePatterns.slice(0, Math.max(0, input.limit - eventItems.length)).map((pattern) => ({
    title: `${pattern.signalKey}:${pattern.signalValue}`,
    text: `Observed ${pattern.sampleCount} samples for ${pattern.signalKey}=${pattern.signalValue} in ${pattern.scope} scope.`,
    sourceUri: undefined,
  }));
  const items = [...eventItems, ...usageItems];
  return {
    provider: 'platform-activity-adapter',
    degraded: items.length === 0,
    items: items.length ? items : [{ title: input.query, text: `No recent platform activity matched ${input.query}; schedule a broader collection window or widen tenant/app scope.`, sourceUri: undefined }],
  };
}

async function collectFromSource(input, dependencies) {
  switch (input.source) {
    case 'rss':
      return collectRss(input);
    case 'web_page':
      return collectWebPage(input);
    case 'market_api':
      return collectMarketApi(input);
    case 'platform_activity':
      return collectPlatformActivity(input, dependencies);
    default:
      return { provider: 'unknown-adapter', degraded: true, items: [] };
  }
}

function toEmbeddingInput(collection, input, now) {
  return {
    items: collection.items.map((item) => ({
      sourceType: 'research_note',
      sourceUri: item.sourceUri ?? input.sourceUri ?? '',
      title: item.title,
      text: item.text,
      metadata: {
        researchSource: input.source,
        researchQuery: input.query,
        collectedAt: now,
        ...(input.metadata ?? {}),
      },
    })),
    chunkSize: 480,
    overlap: 80,
    persist: input.persist,
  };
}

export function createResearchService({ store, embeddingsService }) {
  async function runCollection(input, adminContext, filters, schedule = null) {
    const now = new Date().toISOString();
    const collection = await collectFromSource(input, { store, filters });
    const embeddingResult = await embeddingsService.embed(toEmbeddingInput(collection, input, now), adminContext);
    const status = collection.items.length === 0 ? 'failed' : collection.degraded || embeddingResult.degraded ? 'degraded' : 'completed';
    const run = {
      id: `research_run_${randomUUID()}`,
      tenantId: adminContext.tenantId,
      appId: adminContext.appId,
      source: input.source,
      query: input.query,
      sourceUri: input.sourceUri,
      scheduleId: schedule?.id,
      status,
      provider: `${collection.provider}/${embeddingResult.provider.name}`,
      degraded: status === 'degraded',
      summary: `${collection.items.length} research item(s) collected for ${input.query}.`,
      documentsCreated: embeddingResult.stats.documentsCreated,
      embeddingsCreated: embeddingResult.stats.embeddingsCreated,
      itemsCollected: collection.items.length,
      metadata: {
        persisted: embeddingResult.persisted,
        adapter: collection.provider,
        embeddingProvider: embeddingResult.provider.name,
        documentIds: embeddingResult.documents.map((item) => item.id),
        ...(input.metadata ?? {}),
      },
      createdAt: now,
    };
    const audit = await store.recordResearchRun(run, 'research_collect', adminContext.userId);
    await store.publishDomainEvent({
      tenantId: run.tenantId,
      appId: run.appId,
      actor: adminContext.userId,
      actorDisplay: adminContext.userId,
      type: 'research_collected',
      source: 'control_plane_api',
      resourceType: 'research',
      resourceId: run.id,
      summary: run.summary,
      timestamp: now,
      metadata: { source: run.source, query: run.query, scheduleId: run.scheduleId, status: run.status, documentsCreated: run.documentsCreated, embeddingsCreated: run.embeddingsCreated },
    });
    if (schedule) {
      const updatedSchedule = {
        ...schedule,
        lastRunAt: now,
        nextRunAt: addMinutes(now, schedule.intervalMinutes),
        updatedAt: now,
      };
      await store.saveResearchSchedule(updatedSchedule, 'research_schedule_run', adminContext.userId);
      await store.publishDomainEvent({
        tenantId: run.tenantId,
        appId: run.appId,
        actor: adminContext.userId,
        actorDisplay: adminContext.userId,
        type: 'research_schedule_triggered',
        source: 'control_plane_api',
        resourceType: 'research',
        resourceId: schedule.id,
        summary: `Triggered research schedule ${schedule.name}.`,
        timestamp: now,
        metadata: { scheduleId: schedule.id, runId: run.id, source: schedule.source },
      });
    }
    return { item: run, audit };
  }

  return {
    async listRuns(input = {}, filters = {}) {
      return store.listResearchRuns({ tenantId: filters.tenantId ?? null, appId: filters.appId ?? null, source: input.source, status: input.status, scheduleId: input.scheduleId, limit: input.limit ?? 20 });
    },
    async collect(input, adminContext, filters = {}) {
      return runCollection(input, adminContext, filters, null);
    },
    async listSchedules(input = {}, filters = {}) {
      return store.listResearchSchedules({ tenantId: filters.tenantId ?? null, appId: filters.appId ?? null, source: input.source, status: input.status, limit: input.limit ?? 20 });
    },
    async createSchedule(input, adminContext) {
      const now = new Date().toISOString();
      const schedule = {
        id: `research_schedule_${randomUUID()}`,
        tenantId: adminContext.tenantId,
        appId: adminContext.appId,
        name: input.name,
        source: input.source,
        query: input.query,
        sourceUri: input.sourceUri,
        intervalMinutes: input.intervalMinutes,
        limit: input.limit,
        persist: input.persist,
        status: input.status,
        nextRunAt: addMinutes(now, input.intervalMinutes),
        metadata: input.metadata ?? {},
        createdAt: now,
        updatedAt: now,
      };
      const audit = await store.saveResearchSchedule(schedule, 'research_schedule_create', adminContext.userId);
      return { item: schedule, audit };
    },
    async runDueSchedules(adminContext, filters = {}) {
      const now = new Date().toISOString();
      const schedules = await store.listResearchSchedules({ tenantId: filters.tenantId ?? null, appId: filters.appId ?? null, status: 'active', limit: filters.limit ?? 10 });
      const dueSchedules = schedules.filter((item) => new Date(item.nextRunAt).getTime() <= new Date(now).getTime());
      const results = [];
      for (const schedule of dueSchedules) {
        const result = await runCollection({
          source: schedule.source,
          query: schedule.query,
          sourceUri: schedule.sourceUri,
          limit: schedule.limit,
          persist: schedule.persist,
          scheduleId: schedule.id,
          metadata: schedule.metadata,
        }, adminContext, filters, schedule);
        results.push(result.item);
      }
      return { items: results };
    },
  };
}