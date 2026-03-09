import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { modelsData } from '@/mocks/platform-data';

const { refreshMock, pushSuccessToastMock, pushErrorToastMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  pushSuccessToastMock: vi.fn(),
  pushErrorToastMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    pushSuccessToast: pushSuccessToastMock,
    pushErrorToast: pushErrorToastMock,
  }),
}));

import { ModelMonitor } from '@/components/dashboard/ModelMonitor';

describe('ModelMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('disables routing controls for read-only access', () => {
    render(<ModelMonitor models={[modelsData[0]!]} canSwitch={false} />);

    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByRole('button', { name: /switch to fallback/i })).toBeDisabled();
    expect(screen.getByText(/read-only access for model routing/i)).toBeInTheDocument();
  });

  it('switches the active model through the control-plane route', async () => {
    const nextModel = modelsData[0]!.fallbackModel;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: { ...modelsData[0]!, activeModel: nextModel },
          audit: { summary: 'Planner model switched to fallback.' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<ModelMonitor models={[modelsData[0]!]} canSwitch />);

    fireEvent.click(screen.getByRole('button', { name: /switch to fallback/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/models/switch',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(pushSuccessToastMock).toHaveBeenCalledWith(
      'Model routing updated',
      'Planner model switched to fallback.',
    );
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Planner model switched to fallback.')).toBeInTheDocument();
  });
});