import { describe, expect, it } from 'vitest';
import {
  directoryKey,
  isTelemarketer,
  parseRecentsWords,
  parseWho,
  readPhone,
  resolveWhen,
  type OcrWord,
} from './recents';

const TODAY = '2026-10-30'; // a Friday
const W = 1170; // iPhone 13 screenshot width

/** A word at (x, y) with an approx. 36px-high box, as tesseract reports. */
const w = (text: string, x: number, y: number, red = 0): OcrWord => ({
  text,
  x0: x,
  y0: y - 18,
  x1: x + text.length * 22,
  y1: y + 18,
  red,
});

describe('resolveWhen', () => {
  it('turns Recents labels into India dates', () => {
    expect(resolveWhen('10:42 AM', TODAY)).toEqual({ date: TODAY, time: '10:42' });
    expect(resolveWhen('12:30 AM', TODAY)).toEqual({ date: TODAY, time: '00:30' });
    expect(resolveWhen('9:05 pm', TODAY)).toEqual({ date: TODAY, time: '21:05' });
    expect(resolveWhen('Yesterday', TODAY)?.date).toBe('2026-10-29');
    expect(resolveWhen('Monday', TODAY)?.date).toBe('2026-10-26');
    expect(resolveWhen('Friday', TODAY)?.date).toBe('2026-10-23'); // a week ago, not today
    expect(resolveWhen('21/10/26', TODAY)?.date).toBe('2026-10-21');
    expect(resolveWhen('Hello', TODAY)).toBeNull();
  });
});

describe('readPhone and parseWho', () => {
  it('reads Indian numbers, fixing a misread country code', () => {
    expect(readPhone('+91 98765 43210')).toBe('+919876543210');
    expect(readPhone('+01 14012 34567')).toBe('+911401234567');
    expect(readPhone('098765 43210')).toBe('+919876543210');
    expect(readPhone('9935100221')).toBe('+919935100221');
  });

  it('splits names, numbers and repeat counts', () => {
    expect(parseWho('Rahul Verma (2)')).toEqual({ phone: null, name: 'Rahul Verma', count: 2 });
    expect(parseWho('+91 88967 36659 (3)')).toEqual({
      phone: '+918896736659',
      name: null,
      count: 3,
    });
    expect(parseWho('. Papa')).toEqual({ phone: null, name: 'Papa', count: 1 });
    expect(parseWho('2 Mummy')).toEqual({ phone: null, name: 'Mummy', count: 1 });
    expect(parseWho('7')).toBeNull();
  });
});

describe('parseRecentsWords', () => {
  // Shaped like real OCR output: the name sits above the time, "+91" can land
  // a few pixels lower than the rest of the number, the ⓘ button reads as "(7)".
  const words: OcrWord[] = [
    w('9:41', 80, 50),
    w('Recents', 50, 300),
    // row 1: missed unknown number
    w('98765', 220, 470, 0.92),
    w('43210', 360, 470, 0.92),
    w('+91', 120, 478, 0.54),
    w('India', 120, 540),
    w('10:42', 880, 500),
    w('AM', 1000, 500),
    w('(7)', 1100, 500),
    // row 2: saved contact
    w('Papa', 120, 640),
    w('mobile', 120, 705),
    w('9:58', 880, 670),
    w('AM', 1000, 670),
    // row 3: repeat caller, two days ago
    w('+91', 120, 810),
    w('88967', 220, 810),
    w('36659', 360, 810),
    w('(3)', 500, 810),
    w('India', 120, 875),
    w('Wednesday', 860, 840),
    // tab bar: no anchor
    w('Favourites', 40, 2400),
    w('Recents', 300, 2400),
  ];
  const calls = parseRecentsWords(words, W, TODAY);

  it('finds one call per row and ignores headers and the tab bar', () => {
    expect(calls.map((c) => c.phone_e164 ?? c.contact_name)).toEqual([
      '+919876543210',
      'Papa',
      '+918896736659',
    ]);
  });

  it('keeps time, missed and repeat details', () => {
    expect(calls[0]).toMatchObject({
      missed: true,
      time: '10:42',
      call_at: '2026-10-30T10:42:00+05:30',
    });
    expect(calls[1]).toMatchObject({ missed: false, time: '09:58' });
    expect(calls[2]).toMatchObject({ count: 3, date: '2026-10-28', time: null });
  });

  it('gives each call a stable key so re-imports are skipped', () => {
    expect(calls[0]!.dedupe_key).toBe('+919876543210|2026-10-30|10:42');
    expect(parseRecentsWords(words, W, TODAY)[0]!.dedupe_key).toBe(calls[0]!.dedupe_key);
  });
});

describe('helpers', () => {
  it('spots telemarketers and builds directory keys', () => {
    expect(isTelemarketer('+911401234567')).toBe(true);
    expect(isTelemarketer('+919876543210')).toBe(false);
    expect(directoryKey({ phone_e164: null, contact_name: 'Papa' })).toBe('name:papa');
  });
});
