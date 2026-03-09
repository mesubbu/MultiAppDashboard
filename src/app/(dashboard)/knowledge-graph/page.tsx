import { GraphExplorer } from '@/components/dashboard/GraphExplorer';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { parseKnowledgeGraphQuery } from '@/lib/knowledge-graph';
import { getCurrentSessionUser } from '@/lib/session';
import { controlPlaneService } from '@/services/control-plane';

export default async function KnowledgeGraphPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const [graph, sessionUser] = await Promise.all([
    controlPlaneService.getKnowledgeGraph(parseKnowledgeGraphQuery(resolvedSearchParams)),
    getCurrentSessionUser(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Knowledge Graph" description="Explore relationships across users, vendors, categories, listings, agents, skills, and locations using a graph visualization canvas." />
      <GraphExplorer nodes={graph.nodes} edges={graph.edges} sessionUserId={sessionUser?.userId} />
    </div>
  );
}
