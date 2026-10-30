import { describe, expect, it } from 'vitest';
import { en } from './en';
import { hi } from './hi';
import { withFallback } from './index';

describe('Hindi strings', () => {
  const merged = withFallback(en, hi);

  it('translates what exists and falls back to English for the rest', () => {
    expect(merged.nav.dashboard).toBe('डैशबोर्ड');
    expect(merged.leads.guests(5)).toBe('5 मेहमान');
    expect(merged.quote.print).toBe(en.quote.print);
  });

  it('has a translation for every navigation item and lead stage', () => {
    for (const k of Object.keys(en.nav)) expect(hi.nav?.[k as keyof typeof en.nav]).toBeTruthy();
    for (const k of Object.keys(en.leadStages))
      expect(hi.leadStages?.[k as keyof typeof en.leadStages]).toBeTruthy();
  });

  it('only uses keys that exist in English', () => {
    const walk = (a: Record<string, unknown>, b: Record<string, unknown>, path: string) => {
      for (const [k, v] of Object.entries(b)) {
        expect(a, `${path}.${k}`).toHaveProperty(k);
        if (v && typeof v === 'object' && !Array.isArray(v))
          walk(a[k] as Record<string, unknown>, v as Record<string, unknown>, `${path}.${k}`);
      }
    };
    walk(en as unknown as Record<string, unknown>, hi as unknown as Record<string, unknown>, 't');
  });
});
