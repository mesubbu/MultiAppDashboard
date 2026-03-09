import type { AssistantChatMessage, AssistantToolName, SessionUser } from '@/types/platform';

export type AssistantGatewayRoute = 'analyze' | 'research' | 'recommend' | 'command';

export const assistantStarterPrompts = [
  'Show supply gaps',
  'Prioritize next actions',
  'Run recommendation agent for Growth Concierge',
  'Which agents are throttled?',
  'Summarize service health',
] as const;

export function createAssistantMessage(
  role: AssistantChatMessage['role'],
  content: string,
  toolCalls: AssistantChatMessage['toolCalls'] = [],
): AssistantChatMessage {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    toolCalls,
  };
}

export function pruneAssistantMessages(messages: AssistantChatMessage[], maxMessages = 14) {
  return messages.slice(-maxMessages);
}

export function getAssistantHistoryStorageKey(user: Pick<SessionUser, 'userId' | 'tenantId' | 'appId'>) {
  return `assistant-history:${user.userId}:${user.tenantId}:${user.appId}`;
}

export function getAssistantMemorySessionId(user: Pick<SessionUser, 'userId' | 'tenantId' | 'appId'>) {
  return getAssistantHistoryStorageKey(user);
}

export function extractAssistantPreferences(message: string) {
  const normalized = message.toLowerCase();
  const preferences = [] as Array<{ key: string; value: string }>;

  if (/prefer|keep|use|make/.test(normalized) && /(concise|brief|short)/.test(normalized)) {
    preferences.push({ key: 'response_style', value: 'concise' });
  } else if (/prefer|keep|use|make/.test(normalized) && /(detailed|long-form|detailed answers|more detail)/.test(normalized)) {
    preferences.push({ key: 'response_style', value: 'detailed' });
  }

  if (/bullet|bullets|bullet points/.test(normalized)) {
    preferences.push({ key: 'response_format', value: 'bullets' });
  }

  if (/risk|risky|risks first/.test(normalized)) {
    preferences.push({ key: 'decision_focus', value: 'risk_first' });
  }

  return preferences.filter(
    (item, index, values) => values.findIndex((candidate) => candidate.key === item.key && candidate.value === item.value) === index,
  );
}

export function planAssistantGatewayRoute(
  message: string,
  history: AssistantChatMessage[],
  pathname?: string,
): AssistantGatewayRoute {
  const normalized = message.toLowerCase();

  if (/(run|execute|trigger).*(agent)|record.*(outcome|feedback)/.test(normalized)) {
    return 'command';
  }

  if (/recommend|suggest|what should|next step|priority|prioritize/.test(normalized)) {
    return 'recommend';
  }

  if (/research|supply|demand|gap|market imbalance/.test(normalized)) {
    return 'research';
  }

  if (/those|them|their|what about that/.test(normalized)) {
    const lastTool = [...history]
      .reverse()
      .flatMap((item) => [...item.toolCalls].reverse())
      .find((call) => call.status === 'completed')?.tool;
    if (lastTool === 'control.read.knowledge-graph') {
      return 'research';
    }
  }

  if (pathname?.startsWith('/knowledge-graph')) {
    return 'research';
  }

  return 'analyze';
}

export function getAssistantToolLabel(tool: AssistantToolName) {
  switch (tool) {
    case 'control.read.overview':
      return 'Overview';
    case 'control.read.analytics':
      return 'Analytics';
    case 'control.read.agents':
      return 'Agents';
    case 'control.read.tools':
      return 'Tools';
    case 'control.read.knowledge-graph':
      return 'Knowledge Graph';
    case 'control.read.events':
      return 'Events';
    case 'control.read.observability':
      return 'Observability';
    case 'control.read.memory':
      return 'Memory';
    case 'control.read.models':
      return 'Models';
    case 'control.read.market-signals':
      return 'Market Signals';
    case 'control.read.recommendations':
      return 'Recommendations';
    case 'control.read.agent-performance':
      return 'Agent Performance';
    case 'control.run.research-agent':
      return 'Run Research Agent';
    case 'control.run.insight-agent':
      return 'Run Insight Agent';
    case 'control.run.recommendation-agent':
      return 'Run Recommendation Agent';
    case 'control.write.feedback':
      return 'Record Feedback';
  }
}