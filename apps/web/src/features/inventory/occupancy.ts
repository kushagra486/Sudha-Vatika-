import { addDays } from '@bm/shared';

export type StayStatus = 'reserved' | 'checked_in' | 'checked_out' | 'cancelled';
export const LIVE_STAY_STATUSES: readonly StayStatus[] = ['reserved', 'checked_in'];

export interface StayNights {
  unit_id: string;
  check_in: string;
  check_out: string;
  rooms: number;
  status: StayStatus;
}

/** Rooms taken on each night (check-out day is free), for one unit. */
export function roomsTakenByNight(stays: StayNights[], unitId: string, from: string, days: number) {
  return Array.from({ length: days }, (_, i) => {
    const night = addDays(from, i);
    const taken = stays
      .filter(
        (s) =>
          s.unit_id === unitId &&
          LIVE_STAY_STATUSES.includes(s.status) &&
          s.check_in <= night &&
          s.check_out > night,
      )
      .reduce((n, s) => n + s.rooms, 0);
    return { night, taken };
  });
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
