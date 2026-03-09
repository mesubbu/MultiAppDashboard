import { describe, expect, it } from 'vitest';

import {
  canMoveToStage,
  getAllowedNextStages,
  getInvalidTransitionMessage,
  getNextDependencyState,
} from '@/lib/agent-orchestration';

describe('agent orchestration transitions', () => {
  it('allows ready agents to move along the stage graph', () => {
    expect(
      getAllowedNextStages({ currentStage: 'reason', dependencyState: 'ready' }),
    ).toEqual(['review', 'act']);
    expect(canMoveToStage({ currentStage: 'act', dependencyState: 'ready' }, 'observe')).toBe(
      true,
    );
  });

  it('restricts blocked agents to dependency-safe next stages', () => {
    expect(
      getAllowedNextStages({ currentStage: 'reason', dependencyState: 'blocked' }),
    ).toEqual(['review']);
    expect(canMoveToStage({ currentStage: 'review', dependencyState: 'blocked' }, 'act')).toBe(
      false,
    );
  });

  it('explains invalid transitions', () => {
    expect(
      getInvalidTransitionMessage(
        { currentStage: 'reason', dependencyState: 'waiting' },
        'observe',
      ),
    ).toContain('Valid next stages');
  });

  it('derives dependency state after operator actions', () => {
    expect(getNextDependencyState('review', 0)).toBe('waiting');
    expect(getNextDependencyState('act', 0)).toBe('ready');
    expect(getNextDependencyState('act', 2)).toBe('blocked');
  });
});