import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetTools, mockMetricsCards, mockToolRegistryTable } = vi.hoisted(() => ({
  mockGetTools: vi.fn(),
  mockMetricsCards: vi.fn(() => <div>Metrics cards</div>),
  mockToolRegistryTable: vi.fn(() => <div>Tool table</div>),
}));

vi.mock('@/services/control-plane', () => ({
  controlPlaneService: {
    getTools: mockGetTools,
  },
}));
vi.mock('@/components/dashboard/PageHeader', () => ({ PageHeader: ({ title }: { title: string }) => <div>{title} header</div> }));
vi.mock('@/components/dashboard/MetricsCards', () => ({ MetricsCards: mockMetricsCards }));
vi.mock('@/components/dashboard/ToolRegistryTable', () => ({ ToolRegistryTable: mockToolRegistryTable }));

import ToolsPage from '@/app/(dashboard)/tools/page';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetTools.mockResolvedValue({
    items: [
      { name: 'analysis.summarize.signals', description: 'Analyze supply-gap and health signals.', schema: ['topic:supply_gap|agent_backlog|service_health'], permissions: ['tools:read', 'graph:read'], riskLevel: 'high', executionMode: 'analyze', safetyGuards: ['topic_scoped'], usageToday: 1000, p95Ms: 200, errorRate: 0.2 },
      { name: 'statistics.calculate.summary', description: 'Compute bounded statistics.', schema: ['values:number[]<=500'], permissions: ['tools:read'], riskLevel: 'low', executionMode: 'compute', safetyGuards: ['bounded_input_500'], usageToday: 500, p95Ms: 100, errorRate: 0.05 },
    ],
  });
});

describe('ToolsPage', () => {
  it('builds tool metrics and forwards the tool list to the registry table', async () => {
    render(await ToolsPage());

    expect(screen.getByText('Tool Registry header')).toBeInTheDocument();
    expect(mockMetricsCards).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({ label: 'Registered tools', value: '2' }),
          expect.objectContaining({ label: 'High-risk tools', value: '1' }),
          expect.objectContaining({ label: 'Calls today', value: '1,500' }),
          expect.objectContaining({ label: 'Avg p95', value: '150 ms' }),
        ],
      }),
      undefined,
    );
    expect(mockToolRegistryTable).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [
          expect.objectContaining({ name: 'analysis.summarize.signals', riskLevel: 'high', usageToday: 1000, p95Ms: 200 }),
          expect.objectContaining({ name: 'statistics.calculate.summary', riskLevel: 'low', usageToday: 500, p95Ms: 100 }),
        ],
      }),
      undefined,
    );
  });
});

