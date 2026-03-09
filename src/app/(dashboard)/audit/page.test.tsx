import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/control-plane', () => ({
  controlPlaneService: {
    getAuditPage: vi.fn().mockResolvedValue({
      items: [],
      pageInfo: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
    }),
  },
}));

vi.mock('@/components/dashboard/AuditLogTable', () => ({
  AuditLogTable: () => <div>Audit log table</div>,
}));

vi.mock('@/components/dashboard/MetricsCards', () => ({
  MetricsCards: () => <div>Metrics cards</div>,
}));

vi.mock('@/components/ui/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
}));

import AuditPage from '@/app/(dashboard)/audit/page';

describe('AuditPage', () => {
  it('renders accessible labels for audit filter inputs', async () => {
    render(await AuditPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole('textbox', { name: /search summary or resource/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /actor/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /action/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /resource type/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/from date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/to date/i)).toBeInTheDocument();
  });
});

