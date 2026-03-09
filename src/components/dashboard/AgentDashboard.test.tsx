import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { agentsData } from '@/mocks/platform-data';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    pushErrorToast: vi.fn(),
    pushSuccessToast: vi.fn(),
  }),
}));

import { AgentDashboard } from '@/components/dashboard/AgentDashboard';

describe('AgentDashboard', () => {
  it('exposes labels for filters and editable fields', () => {
    render(<AgentDashboard agents={[agentsData[0]!]} canOperate={false} />);

    expect(screen.getByRole('textbox', { name: /search agents/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /filter agents by state/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /budget \(usd\)/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /workflow version/i })).toBeInTheDocument();
  });

  it('marks the selected agent card as pressed', () => {
    render(<AgentDashboard agents={[agentsData[0]!]} canOperate={false} />);

    expect(screen.getByRole('button', { name: /growth agent/i })).toHaveAttribute('aria-pressed', 'true');
  });
});

