import Link from 'next/link';
import { notFound } from 'next/navigation';

import { MetricsCards } from '@/components/dashboard/MetricsCards';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { buildAppObservationModel } from '@/lib/app-observation';
import { requireCurrentSession } from '@/lib/session';
import { controlPlaneService } from '@/services/control-plane';
import { formatDateTime } from '@/lib/utils';

export default async function AppObservationPage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  await requireCurrentSession();
  const { appId } = await params;

  const [apps, agents, eventPage, auditPage, observability, systemSettings] =
    await Promise.all([
      controlPlaneService.getApps(),
      controlPlaneService.getAgents(),
      controlPlaneService.getEventPage({
        page: 1,
        pageSize: 8,
        query: '',
        appId,
      }),
      controlPlaneService.getAuditPage({
        page: 1,
        pageSize: 8,
        query: '',
        appId,
      }),
      controlPlaneService.getObservability(),
      controlPlaneService.getSystemSettings(),
    ]);

  const app = apps.items.find((item) => item.id === appId);
  if (!app) {
    notFound();
  }

  const observation = buildAppObservationModel({
    app,
    agents: agents.items.filter((agent) => agent.appId === appId),
    services: observability.items,
    events: eventPage.items,
    actions: auditPage.items,
    clientErrors: observability.clientErrors.filter(
      (clientError) => clientError.appId === appId,
    ),
    systemSections: systemSettings.sections,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={app.name}
        description={observation.summary}
        actions={
          <Link
            href="/apps"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/5"
          >
            Back to apps
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200 ring-1 ring-cyan-400/30">
          Single operator
        </span>
        <StatusBadge value={app.status} />
        <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300 ring-1 ring-white/10">
          {app.runtime} runtime
        </span>
        <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300 ring-1 ring-white/10">
          {app.environment}
        </span>
        <span className="text-xs text-slate-500">{app.id}</span>
      </div>

      <MetricsCards items={observation.metrics} />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Runtime services"
          description="Linked VPS services that determine the current runtime health of this app."
        >
          <div className="space-y-3">
            {observation.services.map((service) => (
              <article
                key={service.name}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {service.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {service.layer} layer · {service.endpoint}
                    </p>
                  </div>
                  <StatusBadge value={service.status} />
                </div>
                <div className="mt-4 grid gap-3 text-xs text-slate-300 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                    <p className="text-slate-500">CPU</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {service.cpuPercent}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                    <p className="text-slate-500">Memory</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {service.memoryPercent}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                    <p className="text-slate-500">Restarts / 24h</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {service.restarts24h}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Configuration snapshot"
          description="Current deployment and observability settings relevant to this app."
        >
          <div className="space-y-3">
            {observation.configuration.map((item) => (
              <div
                key={item.key}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  {item.key}
                </p>
                <p className="mt-2 break-words text-sm font-medium text-white">
                  {item.value}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Recent logs"
          description="Agent, event-stream, and operator log lines associated with this app."
        >
          <div className="space-y-3">
            {observation.logs.length ? (
              observation.logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge value={log.level} />
                    <span className="text-xs text-slate-500">{log.source}</span>
                    <span className="text-xs text-slate-500">
                      {formatDateTime(log.timestamp)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-200">
                    {log.message}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">
                No logs are currently available for this app.
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Attached automations"
          description="Agents and workflows currently mapped into this app runtime."
        >
          <div className="space-y-3">
            {observation.agents.length ? (
              observation.agents.map((agent) => (
                <div
                  key={agent.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {agent.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {agent.workflowVersion}
                      </p>
                    </div>
                    <StatusBadge value={agent.state} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                    <span>Queue depth: {agent.queueDepth}</span>
                    <span>Budget: ${agent.budgetUsd}</span>
                    <span>
                      Last heartbeat: {formatDateTime(agent.lastHeartbeatAt)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">
                No automations are currently attached to this app.
              </p>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Recent events"
          description="Latest domain events emitted for this app."
        >
          <div className="space-y-3">
            {observation.recentEvents.length ? (
              observation.recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge value={event.type} />
                    <span className="text-xs text-slate-500">
                      {formatDateTime(event.timestamp)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-white">{event.summary}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Actor: {event.actor}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">
                No recent events were recorded for this app.
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Recent actions"
          description="Operator actions, catalog changes, and audit entries scoped to this app."
        >
          <div className="space-y-3">
            {observation.recentActions.length ? (
              observation.recentActions.map((action) => (
                <div
                  key={action.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge value={action.action} />
                    <span className="text-xs text-slate-500">
                      {formatDateTime(action.timestamp)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-white">
                    {action.summary ?? action.resourceId}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Actor: {action.actorDisplay ?? action.actor} · Resource:{' '}
                    {action.resourceId}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">
                No recent actions were recorded for this app.
              </p>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Client errors"
        description="Recent UI-side exceptions or browser failures reported for this app."
      >
        <div className="space-y-3">
          {observation.clientErrors.length ? (
            observation.clientErrors.map((clientError) => (
              <div
                key={clientError.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge value="error" />
                  <span className="text-xs text-slate-500">
                    {clientError.source}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatDateTime(clientError.occurredAt)}
                  </span>
                </div>
                <p className="mt-3 text-sm text-white">{clientError.message}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {clientError.pathname
                    ? `Path: ${clientError.pathname}`
                    : 'No pathname captured'}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">
              No client-side errors have been captured for this app.
            </p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
