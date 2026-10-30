import { formatDateTime } from '@bm/shared';
import { Send, Sparkles, Trash2, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { useAskAssistant, useAssistantSnapshot, type ChatTurn } from './api';
import { OPEN_EVENT } from './open';

const A = t.assistant;

/** Floating "Ask" button plus the chat panel. Mounted once, in the app layout. */
export function AssistantLauncher() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const pending = useRef<string | null>(null);
  const snapshot = useAssistantSnapshot(open);
  const ask = useAskAssistant(snapshot.data);
  const listEnd = useRef<HTMLDivElement>(null);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || ask.isPending) return;
    const next: ChatTurn[] = [...turns, { role: 'user', content: q }];
    setTurns(next);
    setDraft('');
    ask.mutate(next, {
      onSuccess: (answer) => setTurns((cur) => [...cur, answer]),
      onError: (e) =>
        setTurns((cur) => [
          ...cur,
          {
            role: 'assistant',
            content:
              e instanceof Error && e.message === 'offline_no_data' ? A.offlineNoData : A.error,
            source: 'rules',
          },
        ]),
    });
  };

  useEffect(() => {
    const onOpen = (e: Event) => {
      const q = (e as CustomEvent<string | undefined>).detail;
      setOpen(true);
      if (q) pending.current = q;
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  });

  // Ask a question passed to openAssistant() once the panel is up.
  useEffect(() => {
    if (open && pending.current) {
      const q = pending.current;
      pending.current = null;
      send(q);
    }
  });

  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: 'end' });
  }, [turns.length, ask.isPending]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
  };

  return (
    <>
      <Button
        className="fixed bottom-4 right-4 z-40 h-12 rounded-full px-4 shadow-lg print:hidden"
        onClick={() => setOpen(true)}
        aria-label={A.open}
      >
        <Sparkles className="h-5 w-5" aria-hidden />
        <span className="hidden sm:inline">{A.button}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={t.common.close} className="h-[90dvh] sm:h-[80vh] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden /> {A.title}
            </DialogTitle>
            <DialogDescription>{A.intro}</DialogDescription>
          </DialogHeader>

          <div
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-2"
            aria-live="polite"
          >
            {turns.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {A.suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border px-3 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {turns.map((m, i) => (
              <div
                key={i}
                className={cn(
                  'max-w-[90%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm',
                  m.role === 'user'
                    ? 'self-end bg-primary text-primary-foreground'
                    : 'self-start bg-muted',
                )}
              >
                {m.content}
                {m.role === 'assistant' && m.source && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    {m.source === 'offline' && <WifiOff className="h-3 w-3" aria-hidden />}
                    {m.source === 'llm'
                      ? A.byLlm
                      : m.source === 'offline'
                        ? `${A.offline}${m.asOf ? ` ${formatDateTime(m.asOf)}` : ''}`
                        : A.byRules}
                  </p>
                )}
              </div>
            ))}
            {ask.isPending && (
              <p className="self-start rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                {t.ai.thinking}
              </p>
            )}
            <div ref={listEnd} />
          </div>

          <form onSubmit={submit} className="flex gap-2 border-t pt-3">
            {turns.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={A.clear}
                onClick={() => setTurns([])}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={A.placeholder}
              aria-label={A.placeholder}
              maxLength={1000}
              autoFocus
            />
            <Button
              type="submit"
              size="icon"
              aria-label={A.send}
              disabled={!draft.trim() || ask.isPending}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
