'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bot, History, Loader2, SendHorizonal, Sparkles } from 'lucide-react';

import { getApiErrorMessage } from '@/components/dashboard/admin-client-utils';
import { useToast } from '@/components/ui/toast';
import {
  assistantStarterPrompts,
  createAssistantMessage,
  getAssistantHistoryStorageKey,
  getAssistantToolLabel,
  pruneAssistantMessages,
} from '@/lib/assistant';
import { assistantChatResponseSchema, assistantMessageSchema } from '@/types/contracts';
import type { AssistantChatMessage, SessionUser } from '@/types/platform';

function readStoredMessages(storageKey: string) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [] as AssistantChatMessage[];
    const parsed = JSON.parse(raw) as unknown;
    const result = assistantMessageSchema.array().safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [] as AssistantChatMessage[];
  }
}

export function AssistantSidebar({ sessionUser }: { sessionUser: SessionUser }) {
  const pathname = usePathname();
  const { pushErrorToast } = useToast();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([...assistantStarterPrompts]);

  const storageKey = useMemo(() => getAssistantHistoryStorageKey(sessionUser), [sessionUser]);

  useEffect(() => {
    setMessages(readStoredMessages(storageKey));
    setHasHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hasHydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(pruneAssistantMessages(messages)));
  }, [hasHydrated, messages, storageKey]);

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
  }, [messages, isLoading]);

  async function submitPrompt(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed || isLoading) return;

    const userMessage = createAssistantMessage('user', trimmed);
    const nextHistory = pruneAssistantMessages([...messages, userMessage]);
    setMessages(nextHistory);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/assistant/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: nextHistory,
          pathname,
        }),
      });

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, 'Assistant request failed.'));
      }

      const payload = assistantChatResponseSchema.parse(await response.json());
      setMessages((current) => pruneAssistantMessages([...current, payload.message]));
      setSuggestions(payload.suggestions.length ? payload.suggestions : [...assistantStarterPrompts]);
    } catch (error) {
      pushErrorToast('Assistant unavailable', error instanceof Error ? error.message : 'Assistant request failed.');
      setMessages((current) => current.filter((message) => message.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <aside className="hidden w-[24rem] shrink-0 border-l border-white/10 bg-slate-950/70 xl:block">
      <div className="sticky top-0 flex h-screen flex-col px-4 py-4">
        <div className="rounded-3xl border border-cyan-400/20 bg-slate-950/80 p-4 shadow-2xl shadow-slate-950/40">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-cyan-400/10 p-2 text-cyan-300">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Assistant</p>
              <p className="mt-1 text-xs text-slate-400">
                Control-plane copilot with session-scoped memory and scoped admin commands.
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <History className="h-3.5 w-3.5" />
            <span>{sessionUser.tenantId} / {sessionUser.appId}</span>
          </div>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70">
          <div ref={scrollContainerRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.length ? (
              messages.map((message) => (
                <div key={message.id} className="space-y-2">
                  <div
                    className={message.role === 'assistant'
                      ? 'rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2.5 text-sm text-cyan-50'
                      : 'rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-100'}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                  {message.toolCalls.length ? (
                    <div className="space-y-2 px-1">
                      {message.toolCalls.map((toolCall) => (
                        <div key={`${message.id}-${toolCall.tool}`} className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2">
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="font-medium text-white">{getAssistantToolLabel(toolCall.tool)}</span>
                            <span className={toolCall.status === 'completed' ? 'text-emerald-300' : toolCall.status === 'blocked' ? 'text-amber-300' : 'text-rose-300'}>
                              {toolCall.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">{toolCall.summary}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
                Ask about supply gaps, throttled agents, model routing, observability hotspots, or recent events.
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100">
                <Loader2 className="h-4 w-4 animate-spin" />
                Planning the next control-plane action…
              </div>
            ) : null}
          </div>

          <div className="border-t border-white/10 px-3 py-3">
            <div className="mb-3 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => submitPrompt(suggestion)}
                  disabled={isLoading}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              History is saved per user and current tenant/app context in this browser.
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitPrompt(input);
              }}
              className="flex items-center gap-2"
            >
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask or command the assistant"
                aria-label="Ask the assistant"
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400/40"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Send assistant message"
              >
                <SendHorizonal className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  );
}