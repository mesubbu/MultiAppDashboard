import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { agentsData } from '@/mocks/platform-data';

const { pushSuccessToastMock, pushErrorToastMock, refreshMock } = vi.hoisted(() => ({
  pushSuccessToastMock: vi.fn(),
  pushErrorToastMock: vi.fn(),
  refreshMock: vi.fn(),
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

import { AgentOrchestrationBoard } from '@/components/dashboard/AgentOrchestrationBoard';

describe('AgentOrchestrationBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('supports read-only inspection of orchestration state and blockers', () => {
    render(<AgentOrchestrationBoard agents={agentsData.slice(0, 3)} canOperate={false} />);

    expect(screen.getByText(/read-only access for orchestration controls/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry queue/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /unblock/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /moderation agent/i }));
    expect(screen.getByText(/reviewer capacity saturated for outreach copy approval/i)).toBeInTheDocument();
  });
});