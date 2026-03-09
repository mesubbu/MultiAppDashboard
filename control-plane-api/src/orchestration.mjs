export const orchestrationStageGraph = {
  intake: ['reason'],
  reason: ['review', 'act'],
  review: ['act'],
  act: ['observe'],
  observe: ['intake'],
};

const dependencyStageAllowlist = {
  ready: null,
  waiting: ['review', 'act'],
  blocked: ['review'],
};

function labelizeStage(stage) {
  return stage.replaceAll('_', ' ');
}

export function getAllowedNextStages(context) {
  const baseStages = orchestrationStageGraph[context.currentStage] ?? [];
  const allowedStages = dependencyStageAllowlist[context.dependencyState] ?? null;
  return allowedStages
    ? baseStages.filter((stage) => allowedStages.includes(stage))
    : baseStages;
}

export function canMoveToStage(context, targetStage) {
  return getAllowedNextStages(context).includes(targetStage);
}

export function getNextDependencyState(stage, blockerCount) {
  if (blockerCount > 0) {
    return 'blocked';
  }

  return stage === 'review' ? 'waiting' : 'ready';
}

export function getInvalidTransitionMessage(context, targetStage) {
  const allowed = getAllowedNextStages(context);
  if (!allowed.length) {
    return `No valid next stages from ${labelizeStage(context.currentStage)} while dependencies are ${labelizeStage(context.dependencyState)}.`;
  }

  return `Cannot move from ${labelizeStage(context.currentStage)} to ${labelizeStage(targetStage)} while dependencies are ${labelizeStage(context.dependencyState)}. Valid next stages: ${allowed.map(labelizeStage).join(', ')}.`;
}