import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form';
import { t } from '@/i18n';
import { AiSourceNote } from './AiBadge';
import { useExtract, type ExtractResult } from './api';

/** Paste a WhatsApp message or call notes; the form fills itself. */
export function PasteToFill({ onFill }: { onFill: (r: ExtractResult, text: string) => void }) {
  const extract = useExtract();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  if (!open)
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => setOpen(true)}
      >
        <Sparkles className="h-4 w-4 text-violet-600" /> {t.ai.pasteButton}
      </Button>
    );
  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
      <Textarea
        aria-label={t.ai.pasteLabel}
        rows={3}
        autoFocus
        placeholder={t.ai.pasteLabel}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button
        type="button"
        size="sm"
        className="self-start"
        disabled={!text.trim() || extract.isPending}
        onClick={() => extract.mutate(text.trim(), { onSuccess: (r) => onFill(r, text.trim()) })}
      >
        {extract.isPending ? t.ai.thinking : t.ai.fill}
      </Button>
      {extract.isError && <p className="text-sm text-destructive">{t.ai.error}</p>}
      {extract.data && <AiSourceNote source={extract.data.source} />}
    </div>
  );
}
