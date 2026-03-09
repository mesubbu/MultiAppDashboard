import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildObservabilityLiveSnapshot } from '@/lib/observability-live-charts';
import { modelsData, observabilityData, overviewData } from '@/mocks/platform-data';

import { LiveObservabilityCharts } from '@/components/dashboard/LiveObservabilityCharts';

const initialSnapshot = buildObservabilityLiveSnapshot({
  capturedAt: '2026-03-09T12:00:00.000Z',
  overview: overviewData,
  observability: { items: observabilityData },
  models: { items: modelsData },
});

describe('LiveObservabilityCharts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders the initial observability snapshot', () => {
    render(<LiveObservabilityCharts initialSnapshot={initialSnapshot} />);

    expect(screen.getByText('Live infrastructure charts')).toBeInTheDocument();
    expect(screen.getByText('1 recent samples retained')).toBeInTheDocument();
    expect(screen.getByText('Queue backlog trend')).toBeInTheDocument();
    expect(screen.getByText('control-plane-api')).toBeInTheDocument();
    expect(screen.getByText('planner-slm')).toBeInTheDocument();
  });

  it('surfaces polling failures as a visible error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    vi.spyOn(window, 'setInterval').mockImplementation((callback) => {
      void callback();
      return 1 as unknown as ReturnType<typeof setInterval>;
    });
    vi.spyOn(window, 'clearInterval').mockImplementation(() => undefined);

    render(<LiveObservabilityCharts initialSnapshot={initialSnapshot} />);

    await waitFor(() => expect(screen.getByText(/unable to refresh live observability metrics/i)).toBeInTheDocument());
  });
});