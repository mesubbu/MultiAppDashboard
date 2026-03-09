import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SessionUser } from '@/types/platform';

let mockPathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

vi.mock('@/components/layout/TenantSwitcher', () => ({
  TenantSwitcher: () => <div data-testid="tenant-switcher" />,
}));

import { Sidebar } from '@/components/layout/Sidebar';

const sessionUser: SessionUser = {
  userId: 'user_owner_01',
  tenantId: 'tenant_acme',
  appId: 'app_market_web',
  name: 'Owner',
  email: 'owner@platform.local',
  roles: ['platform_owner'],
};

describe('Sidebar', () => {
  it('marks the current navigation link with aria-current', { timeout: 15_000 }, () => {
    mockPathname = '/observability';

    render(<Sidebar sessionUser={sessionUser} tenantOptions={[]} appOptions={[]} />);

    expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute('href', '/observability');
    expect(screen.getByRole('link', { name: /platform overview/i })).not.toHaveAttribute('aria-current');
  });
});

