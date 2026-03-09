import { describe, expect, it } from 'vitest';

import {
  buildAgentActionSummary,
  createAgentAuditRecord,
  formatAgentActionLabel,
} from '@/lib/agent-audit';

describe('agent audit helpers', () => {
  it('formats action labels for the board', () => {
    expect(formatAgentActionLabel('retry_queue')).toBe('retry queue');
  });

  it('builds stage-aware summaries', () => {
    expect(buildAgentActionSummary('reroute', { stage: 'review', lane: 'Human review' })).toBe(
      'Rerouted agent to review · Human review',
    );
  });

  it('creates structured audit records', () => {
    expect(
      createAgentAuditRecord({
        action: 'retry_queue',
        actor: 'usr_platform_admin',
        actorDisplay: 'Rhea Sharma',
        resourceId: 'agent_growth_01',
        timestamp: '2026-03-08T14:10:00.000Z',
      }).summary,
    ).toBe('Retried queue execution');
  });
});