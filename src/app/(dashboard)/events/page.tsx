import { EventStream } from '@/components/dashboard/EventStream';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { controlPlaneService } from '@/services/control-plane';

export default async function EventsPage() {
  const events = await controlPlaneService.getEvents();

  return (
    <div className="space-y-6">
      <PageHeader title="Events" description="Live platform event stream covering listings, orders, messages, and agent triggers with tenant and app filtering." />
      <EventStream key={events.items.map((event) => event.id).join('|')} events={events.items} />
    </div>
  );
}
