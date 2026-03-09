import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { eventsData } from '@/mocks/platform-data';

const { useLiveEventStreamMock } = vi.hoisted(() => ({
  useLiveEventStreamMock: vi.fn(),
}));

vi.mock('@/hooks/useLiveEventStream', () => ({
  useLiveEventStream: useLiveEventStreamMock,
}));

import { EventStream } from '@/components/dashboard/EventStream';

describe('EventStream', () => {
  beforeEach(() => {
    useLiveEventStreamMock.mockReset();
  });

  it('renders live stream status and forwards filter interactions to the hook', () => {
    const setFilters = vi.fn();
    const togglePaused = vi.fn();
    useLiveEventStreamMock.mockReturnValue({
      bufferedCount: 2,
      connectionState: 'live',
      filteredEvents: [eventsData[0]!],
      filters: { tenantId: 'all', appId: 'all', type: 'all' },
      isPaused: false,
      liveEvents: eventsData.slice(0, 3),
      reconnectInMs: null,
      setFilters,
      togglePaused,
    });

    render(<EventStream events={eventsData.slice(0, 3)} />);

    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('1 visible')).toBeInTheDocument();
    expect(screen.getByText('2 buffered')).toBeInTheDocument();
    expect(screen.getByText(eventsData[0]!.summary)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /pause stream/i }));
    expect(togglePaused).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByRole('combobox', { name: /filter events by tenant/i }), {
      target: { value: eventsData[0]!.tenantId },
    });
    expect(setFilters).toHaveBeenCalledWith(expect.any(Function));
  });

  it('shows empty-state recovery controls when paused with active filters', () => {
    const setFilters = vi.fn();
    const togglePaused = vi.fn();
    useLiveEventStreamMock.mockReturnValue({
      bufferedCount: 0,
      connectionState: 'paused',
      filteredEvents: [],
      filters: { tenantId: 'tenant_acme', appId: 'all', type: 'all' },
      isPaused: true,
      liveEvents: eventsData.slice(0, 3),
      reconnectInMs: null,
      setFilters,
      togglePaused,
    });

    render(<EventStream events={eventsData.slice(0, 3)} />);

    fireEvent.click(screen.getAllByRole('button', { name: /resume stream/i })[0]!);
    expect(togglePaused).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(setFilters).toHaveBeenCalledWith({ tenantId: 'all', appId: 'all', type: 'all' });
  });
});