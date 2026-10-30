import { formatDateTime } from '@bm/shared';
import { FileText, Paperclip, Send, Sparkles, Trash2, WifiOff, X } from 'lucide-react';
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
import { AddEnquiryCard } from './ActionCard';
import {
  NeedsAiError,
  useAnalyzeFiles,
  useAskAssistant,
  useAssistantSnapshot,
  type ChatTurn,
} from './api';
import { DocumentCard } from './DocumentCard';
import { ACCEPT, MAX_FILES, prepareFiles, UnsupportedFileError } from './files';
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
  const analyze = useAnalyzeFiles();
  const [files, setFiles] = useState<File[]>([]);
  const [reading, setReading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const listEnd = useRef<HTMLDivElement>(null);
  const busy = ask.isPending || analyze.isPending || reading;
  const reply = (turn: ChatTurn) => setTurns((cur) => [...cur, turn]);

  /** Files (with an optional note) go to the document reader, not the chat. */
  const sendFiles = async (note: string) => {
    const picked = files;
    setTurns((cur) => [
      ...cur,
      { role: 'user', content: note || A.docs.sent, files: picked.map((f) => f.name) },
    ]);
    setDraft('');
    setFiles([]);
    setReading(true);
    let prepared;
    try {
      prepared = await prepareFiles(picked);
    } catch (e) {
      setReading(false);
      return reply({
        role: 'assistant',
        content:
          e instanceof UnsupportedFileError ? A.docs.unsupported(e.message) : A.docs.readError,
        source: 'rules',
      });
    }
    setReading(false);
    analyze.mutate(
      { message: note, text: prepared.text, images: prepared.images },
      {
        onSuccess: reply,
        onError: (e) =>
          reply({
            role: 'assistant',
            content: e instanceof NeedsAiError ? A.docs.needsAi : A.error,
            source: 'rules',
          }),
      },
    );
  };

  const send = (text: string) => {
    const q = text.trim();
    if (busy) return;
    if (files.length) return void sendFiles(q);
    if (!q) return;
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
  }, [turns.length, busy]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
  };

  return (
    <>
      <Button
        className="fixed bottom-20 right-4 z-40 h-12 rounded-full px-4 shadow-lg print:hidden"
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
                {m.files?.length ? (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {m.files.map((f) => (
                      <span
                        key={f}
                        className="inline-flex items-center gap-1 rounded bg-black/10 px-1.5 py-0.5 text-xs"
                      >
                        <FileText className="h-3 w-3" aria-hidden /> {f}
                      </span>
                    ))}
                  </span>
                ) : null}
                {m.analysis && (
                  <DocumentCard analysis={m.analysis} bookings={snapshot.data?.bookings ?? []} />
                )}
                {m.action?.type === 'add_enquiry' && (
                  <AddEnquiryCard draft={m.action.draft} onDone={() => setOpen(false)} />
                )}
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
            {busy && (
              <p className="self-start rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                {ask.isPending ? t.ai.thinking : A.docs.reading}
              </p>
            )}
            <div ref={listEnd} />
          </div>

          {files.length > 0 && (
            <div className="flex flex-wrap gap-1 border-t pt-2">
              {files.map((f, i) => (
                <span
                  key={`${f.name}-${i}`}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                >
                  <FileText className="h-3 w-3" aria-hidden /> {f.name}
                  <button
                    type="button"
                    aria-label={A.docs.remove(f.name)}
                    onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                    className="rounded-full p-0.5 hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <form onSubmit={submit} className="flex gap-2 border-t pt-3">
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT}
              multiple
              hidden
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                setFiles((cur) => [...cur, ...picked].slice(0, MAX_FILES));
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={A.docs.attach}
              title={A.docs.attach}
              onClick={() => fileInput.current?.click()}
              disabled={busy}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
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
              placeholder={files.length ? A.docs.notePlaceholder : A.placeholder}
              aria-label={files.length ? A.docs.notePlaceholder : A.placeholder}
              maxLength={1000}
              autoFocus
            />
            <Button
              type="submit"
              size="icon"
              aria-label={A.send}
              disabled={(!draft.trim() && !files.length) || busy}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
