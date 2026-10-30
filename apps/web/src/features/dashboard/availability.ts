import { addDays, SHIFTS, type Shift } from '@bm/shared';

export type CellState = 'free' | 'partial' | 'full' | 'upcoming';

export interface Cell {
  state: CellState;
  /** Booked meal slots in day order, never including full_day. */
  shifts: Shift[];
}

const MEAL_SLOTS = SHIFTS.filter((s) => s !== 'full_day');

/**
 * State of one space on one day. A full_day booking, or every meal slot
 * booked separately, makes the day full.
 */
export function cellFor(booked: Shift[], upcoming: boolean): Cell {
  if (upcoming) return { state: 'upcoming', shifts: [] };
  if (booked.includes('full_day')) return { state: 'full', shifts: [] };
  const shifts = MEAL_SLOTS.filter((s) => booked.includes(s));
  if (shifts.length === 0) return { state: 'free', shifts };
  return { state: shifts.length === MEAL_SLOTS.length ? 'full' : 'partial', shifts };
}

/** Consecutive YYYY-MM-DD dates starting at `from`. */
export function dateRange(from: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(from, i));
}

/** One-letter shift codes for the grid; the legend spells them out. */
export const SHIFT_LETTERS: Record<Shift, string> = {
  full_day: 'F',
  breakfast: 'B',
  lunch: 'L',
  high_tea: 'T',
  dinner: 'D',
};
