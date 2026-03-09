import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAssistantHistoryStorageKey } from '@/lib/assistant';
import type { SessionUser } from '@/types/platform';

const { navState, pushErrorToastMock } = vi.hoisted(() => ({
  navState: { pathname: '/observability' },
  pushErrorToastMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navState.pathname,
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    pushErrorToast: pushErrorToastMock,
    pushSuccessToast: vi.fn(),
  }),
}));

import { AssistantSidebar } from '@/components/layout/AssistantSidebar';

const sessionUser: SessionUser = {
  userId: 'owner',
  tenantId: 'platform-root',
  appId: 'control-dashboard',
  name: 'Owner',
  email: 'owner@test.local',
  roles: ['platform_owner'],
};

describe('AssistantSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
        clear: () => {
          storage.clear();
        },
      },
      configurable: true,
    });
  });

  it('loads stored conversation history and persists new assistant replies', async () => {
    const storageKey = getAssistantHistoryStorageKey(sessionUser);
    window.localStorage.setItem(
      storageKey,
      JSON.stringify([
        {
          id: 'assistant-existing',
          role: 'assistant',
          content: 'Stored summary',
          createdAt: '2026-03-08T10:00:00.000Z',
          toolCalls: [],
        },
      ]),
    );

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: {
            id: 'assistant-1',
            role: 'assistant',
            content: 'Found 1 throttled agent in scope.',
            createdAt: '2026-03-09T10:00:00.000Z',
            toolCalls: [
              {
                tool: 'control.read.agents',
                permission: 'agents:read',
                status: 'completed',
                summary: 'Inspected 3 agents and found 1 throttled agent.',
              },
            ],
          },
          suggestions: ['Show recent events'],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    vi.stubGlobal('fetch', fetchMock);

    render(<AssistantSidebar sessionUser={sessionUser} />);

    expect(await screen.findByText('Stored summary')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: /ask the assistant/i }), {
      target: { value: 'Which agents are throttled?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send assistant message/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(requestBody.message).toBe('Which agents are throttled?');
    expect(requestBody.pathname).toBe('/observability');
    expect(requestBody.history.at(-1)).toEqual(
      expect.objectContaining({
        role: 'user',
        content: 'Which agents are throttled?',
      }),
    );

    expect(await screen.findByText('Found 1 throttled agent in scope.')).toBeInTheDocument();
    expect(screen.getByText('Agents')).toBeInTheDocument();
    expect(screen.getByText('Show recent events')).toBeInTheDocument();

    await waitFor(() => {
      expect(window.localStorage.getItem(storageKey)).toContain('Found 1 throttled agent in scope.');
    });
  });
});