import type { AgentActionName, AgentOrchestrationStage, AuditRecord } from '@/types/platform';

export function formatAgentActionLabel(action: AuditRecord['action']) {
  return action.replaceAll('_', ' ');
}

export function buildAgentActionSummary(
  action: AgentActionName,
  details: { stage?: AgentOrchestrationStage; lane?: string } = {},
) {
  const stageSuffix = details.stage ? ` to ${details.stage}` : '';
  const laneSuffix = details.lane ? ` · ${details.lane}` : '';

  switch (action) {
    case 'move_stage':
      return `Moved stage${stageSuffix}${laneSuffix}`;
    case 'retry_queue':
      return 'Retried queue execution';
    case 'unblock':
      return 'Cleared active blockers';
    case 'reroute':
      return `Rerouted agent${stageSuffix}${laneSuffix}`;
    case 'pause':
      return 'Paused agent execution';
    case 'restart':
      return 'Restarted agent execution';
    case 'update_budget':
      return 'Updated agent budget';
    case 'update_workflow':
      return 'Updated workflow version';
  }
}

export function createAgentAuditRecord(options: {
  action: AgentActionName;
  actor: string;
  actorDisplay?: string;
  resourceId: string;
  timestamp: string;
  stage?: AgentOrchestrationStage;
  lane?: string;
}) {
  const { action, actor, actorDisplay, resourceId, timestamp, stage, lane } = options;
  return {
    id: `audit_${resourceId}_${timestamp}`,
    actor,
    actorDisplay,
    action,
    resourceType: 'agent',
    resourceId,
    timestamp,
    summary: buildAgentActionSummary(action, { stage, lane }),
  } satisfies AuditRecord;
}