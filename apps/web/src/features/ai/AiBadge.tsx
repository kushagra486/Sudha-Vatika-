import type { AiSource } from '@bm/shared';
import { Sparkles } from 'lucide-react';
import { t } from '@/i18n';

/** Says who produced a suggestion, so staff know how much to trust it. */
export function AiSourceNote({ source }: { source: AiSource }) {
  return (
    <p className="flex items-center gap-1 text-xs text-muted-foreground">
      <Sparkles className="h-3 w-3" /> {source === 'llm' ? t.ai.byLlm : t.ai.byRules}
    </p>
  );
}
