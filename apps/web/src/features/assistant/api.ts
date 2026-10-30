import { answerByRules, todayIST, type AiSource, type AssistantSnapshot } from '@bm/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { requireSupabase } from '@/lib/supabase';

// The assistant's knowledge is one snapshot of the venue's data. A copy is
// kept on this device so questions still get answers when the phone is
// offline or no AI model replies. It is wiped on sign-out.
const CACHE_KEY = 'bm.assistant.snapshot';
const AI_TIMEOUT_MS = 40_000;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  /** How the answer was made; only on assistant turns. */
  source?: AiSource | 'offline';
  /** When the data behind an offline answer was fetched. */
  asOf?: string;
}

function readCache(): AssistantSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as AssistantSnapshot) : null;
  } catch {
    return null;
  }
}

function writeCache(s: AssistantSnapshot) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(s));
  } catch {
    // Storage full or blocked: offline answers just won't be available.
  }
}

export function clearAssistantCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

/** Fetches the snapshot while the panel is open, so the offline copy stays fresh. */
export function useAssistantSnapshot(enabled: boolean) {
  return useQuery({
    queryKey: ['assistant', 'snapshot'],
    enabled,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('assistant_snapshot');
      if (error) throw error;
      const snap = data as AssistantSnapshot;
      writeCache(snap);
      return snap;
    },
  });
}

/** Answer on the device from the newest snapshot we have, or null if none. */
function answerOffline(question: string, fresh?: AssistantSnapshot): ChatTurn | null {
  const snap = fresh ?? readCache();
  if (!snap) return null;
  // Relative words ("today", "kal") mean the real today, not the snapshot's.
  const content = answerByRules(question, { ...snap, today: todayIST() });
  return { role: 'assistant', content, source: 'offline', asOf: snap.generated_at };
}

async function askServer(messages: ChatTurn[]): Promise<ChatTurn> {
  const call = requireSupabase().functions.invoke('ai', {
    body: {
      action: 'chat',
      messages: messages.slice(-12).map(({ role, content }) => ({ role, content })),
    },
  });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), AI_TIMEOUT_MS),
  );
  const { data, error } = await Promise.race([call, timeout]);
  if (error) throw error;
  const r = data as { answer: string; source: AiSource };
  return { role: 'assistant', content: r.answer, source: r.source };
}

/**
 * Ask the assistant. Online, the server answers (AI model, or its own rules
 * when every model is busy). Offline, or if the server doesn't reply in time,
 * the device answers from its saved copy of the data.
 */
export function useAskAssistant(fresh?: AssistantSnapshot) {
  return useMutation({
    mutationFn: async (messages: ChatTurn[]): Promise<ChatTurn> => {
      const question = messages[messages.length - 1]!.content;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const local = answerOffline(question, fresh);
        if (local) return local;
        throw new Error('offline_no_data');
      }
      try {
        return await askServer(messages);
      } catch (e) {
        const local = answerOffline(question, fresh);
        if (local) return local;
        throw e;
      }
    },
  });
}
