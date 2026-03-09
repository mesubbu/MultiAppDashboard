import type {
  AgentDependencyState,
  AgentOrchestrationStage,
} from '@/types/platform';

export interface AgentTransitionContext {
  currentStage: AgentOrchestrationStage;
  dependencyState: AgentDependencyState;
}

export const orchestrationStageGraph: Record<
  AgentOrchestrationStage,
  AgentOrchestrationStage[]
> = {
  intake: ['reason'],
  reason: ['review', 'act'],
  review: ['act'],
  act: ['observe'],
  observe: ['intake'],
};

const dependencyStageAllowlist: Record<
  AgentDependencyState,
  AgentOrchestrationStage[] | null
> = {
  ready: null,
  waiting: ['review', 'act'],
  blocked: ['review'],
};

function labelize(value: string) {
  return value.replaceAll('_', ' ');
}

export function getAllowedNextStages(context: AgentTransitionContext) {
  const baseStages = orchestrationStageGraph[context.currentStage];
  const allowedStages = dependencyStageAllowlist[context.dependencyState];
  return allowedStages
    ? baseStages.filter((stage) => allowedStages.includes(stage))
    : baseStages;
}

export function canMoveToStage(
  context: AgentTransitionContext,
  targetStage: AgentOrchestrationStage,
) {
  return getAllowedNextStages(context).includes(targetStage);
}

export function getNextDependencyState(
  stage: AgentOrchestrationStage,
  blockerCount: number,
): AgentDependencyState {
  if (blockerCount > 0) {
    return 'blocked';
  }

  return stage === 'review' ? 'waiting' : 'ready';
}

export function getInvalidTransitionMessage(
  context: AgentTransitionContext,
  targetStage: AgentOrchestrationStage,
) {
  const allowed = getAllowedNextStages(context);
  if (allowed.length === 0) {
    return `No valid next stages from ${labelize(context.currentStage)} while dependencies are ${labelize(context.dependencyState)}.`;
  }

  return `Cannot move from ${labelize(context.currentStage)} to ${labelize(targetStage)} while dependencies are ${labelize(context.dependencyState)}. Valid next stages: ${allowed.map(labelize).join(', ')}.`;
}