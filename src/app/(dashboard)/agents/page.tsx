import { Suspense, cache } from 'react';

import { AgentDashboard } from '@/components/dashboard/AgentDashboard';
import { AgentOrchestrationBoard } from '@/components/dashboard/AgentOrchestrationBoard';
import { MetricsCards } from '@/components/dashboard/MetricsCards';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { hasPermission } from '@/lib/rbac';
import { requireCurrentSession } from '@/lib/session';
import { controlPlaneService } from '@/services/control-plane';

const getAgentsData = cache(() => controlPlaneService.getAgents());

function MetricsCardsFallback() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 shadow-lg shadow-slate-950/10">
          <Skeleton className="h-4 w-24" />
          <div className="mt-3 flex items-center justify-between gap-3">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-4/5" />
        </div>
      ))}
    </div>
  );
}

function SectionFallback({ title, description, blockHeight }: { title: string; description: string; blockHeight: string }) {
  return (
    <SectionCard title={title} description={description}>
      <Skeleton className={`w-full ${blockHeight}`} />
    </SectionCard>
  );
}

async function AgentsMetricsSection() {
  const agents = await getAgentsData();

  return (
    <MetricsCards
      items={[
        {
          label: 'Running',
          value: `${agents.items.filter((agent) => agent.state === 'running').length}`,
          delta: '+1',
          trend: 'up',
          description: 'Agents actively processing tasks.',
        },
        {
          label: 'Queue depth',
          value: `${agents.items.reduce((sum, agent) => sum + agent.queueDepth, 0)}`,
          delta: '-4%',
          trend: 'down',
          description: 'Combined queue depth across the agent fleet.',
        },
        {
          label: 'Blocked agents',
          value: `${agents.items.filter((agent) => agent.orchestration.dependencyState === 'blocked' || agent.orchestration.blockers.length > 0).length}`,
          delta: '-1',
          trend: 'down',
          description: 'Agents currently blocked by review or dependency constraints.',
        },
        {
          label: 'Dependency links',
          value: `${agents.items.reduce((sum, agent) => sum + agent.orchestration.upstreamAgentIds.length, 0)}`,
          delta: '+2',
          trend: 'up',
          description: 'Cross-agent upstream dependencies active in the orchestration board.',
        },
      ]}
    />
  );
}

async function AgentsBoardSection({ canOperate }: { canOperate: boolean }) {
  const agents = await getAgentsData();
  const agentStateKey = agents.items
    .map(
      (agent) =>
        `${agent.id}:${agent.state}:${agent.workflowVersion}:${agent.orchestration.stage}:${agent.orchestration.dependencyState}`,
    )
    .join('|');

  return <AgentOrchestrationBoard key={agentStateKey} agents={agents.items} canOperate={canOperate} />;
}

async function AgentsDetailSection({ canOperate }: { canOperate: boolean }) {
  const agents = await getAgentsData();
  const agentStateKey = agents.items
    .map(
      (agent) =>
        `${agent.id}:${agent.state}:${agent.workflowVersion}:${agent.orchestration.stage}:${agent.orchestration.dependencyState}`,
    )
    .join('|');

  return <AgentDashboard key={agentStateKey} agents={agents.items} canOperate={canOperate} />;
}

async function AgentIntelligenceSection() {
  const [recommendations, performance] = await Promise.all([
    controlPlaneService.getRecommendations(),
    controlPlaneService.getAgentPerformance(),
  ]);

  return (
    <SectionCard title="Operator intelligence" description="Latest recommendation-agent outputs and self-learning feedback metrics for the current scope.">
      <div className="grid gap-6 xl:grid-cols-[1.4fr,1fr]">
        <div className="space-y-3">
          {recommendations.items.slice(0, 4).map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-300">{item.summary}</p>
                </div>
                <StatusBadge value={item.priority} />
              </div>
              <p className="mt-2 text-xs text-slate-400">{Math.round(item.confidence * 100)}% confidence · {item.category.replaceAll('_', ' ')}</p>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Avg success</p>
              <p className="mt-2 text-2xl font-semibold text-white">{Math.round(performance.summary.averageSuccessRate * 100)}%</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Feedback score</p>
              <p className="mt-2 text-2xl font-semibold text-white">{performance.summary.averageFeedbackScore.toFixed(2)}</p>
            </div>
          </div>
          {performance.items.slice(0, 3).map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">{item.agentId}</p>
                <StatusBadge value={item.trend === 'up' ? 'healthy' : item.trend === 'down' ? 'critical' : 'degraded'} />
              </div>
              <p className="mt-2 text-xs text-slate-400">Success {Math.round(item.successRate * 100)}% · Feedback {item.feedbackScore.toFixed(2)} · {item.taskCount} outcomes</p>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

export default async function AgentsPage() {
  const session = await requireCurrentSession();
  const canOperate = hasPermission(session.user.roles, 'agents:operate');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agents"
        description="Operate autonomous agents, inspect tasks and decisions, review logs and execution history, and adjust workflow/budget controls."
      />
      <Suspense fallback={<MetricsCardsFallback />}>
        <AgentsMetricsSection />
      </Suspense>
      <Suspense fallback={<SectionFallback title="Agent orchestration board" description="Loading stage lanes, dependency health, and queue controls." blockHeight="h-[34rem]" />}>
        <AgentsBoardSection canOperate={canOperate} />
      </Suspense>
      <Suspense fallback={<SectionFallback title="Agent dashboard" description="Loading per-agent execution details, logs, and workflow controls." blockHeight="h-[42rem]" />}>
        <AgentsDetailSection canOperate={canOperate} />
      </Suspense>
      <Suspense fallback={<SectionFallback title="Operator intelligence" description="Loading recommendation outputs and learning metrics." blockHeight="h-[18rem]" />}>
        <AgentIntelligenceSection />
      </Suspense>
    </div>
  );
}
