import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentMonitor } from '@/components/dashboard/AgentMonitor';
import { agentsData } from '@/mocks/platform-data';

describe('AgentMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('optimistically updates budget and pause actions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(<AgentMonitor agents={[agentsData[0]!]} />);

    const budgetInput = screen.getByRole('spinbutton', { name: /budget \(usd\)/i });
    fireEvent.change(budgetInput, { target: { value: '450' } });
    fireEvent.blur(budgetInput);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      action: 'update_budget',
      budgetUsd: 450,
    });
    expect(screen.getByText(/\$450(?:\.00)?/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /pause/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({ action: 'pause' });
    expect(screen.getByText(/paused/i)).toBeInTheDocument();
  });
});