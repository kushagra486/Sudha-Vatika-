import { en, type Strings } from './en';
import { hi } from './hi';

export type Lang = 'en' | 'hi';
const KEY = 'bm.lang';

export function currentLang(): Lang {
  try {
    return localStorage.getItem(KEY) === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

/** Deep merge: translated keys win, everything else stays English. */
export function withFallback<T>(base: T, over: unknown): T {
  if (over === undefined || over === null) return base;
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return over as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    out[k] = withFallback((base as Record<string, unknown>)[k], v);
  }
  return out as T;
}

const lang = currentLang();
if (typeof document !== 'undefined') document.documentElement.lang = lang;

export const t: Strings = lang === 'hi' ? withFallback(en, hi) : en;

/** Saves the choice and reloads so every screen picks it up. */
export function setLang(next: Lang) {
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* private mode: stays English */
  }
  window.location.reload();
}
