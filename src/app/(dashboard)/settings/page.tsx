import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { controlPlaneService } from '@/services/control-plane';

export default async function SettingsPage() {
  const settings = await controlPlaneService.getSystemSettings();

  return (
    <div className="space-y-6">
      <PageHeader title="System Settings" description="Global settings spanning security, control-plane connectivity, and observability defaults." />
      <div className="grid gap-6 xl:grid-cols-2">
        {settings.sections.map((section) => (
          <SectionCard key={section.title} title={section.title} description="Configuration defaults surfaced by the control plane.">
            <div className="space-y-3">
              {section.items.map((item) => (
                <div key={item.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-white">{item.key}</p>
                    <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-xs text-cyan-300">{item.value}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{item.description}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
