import { describe, expect, it } from 'vitest';
import { nightsBetween, roomsTakenByNight, type StayNights } from './occupancy';

const stay = (
  check_in: string,
  check_out: string,
  rooms: number,
  status: StayNights['status'] = 'reserved',
) => ({
  unit_id: 'r',
  check_in,
  check_out,
  rooms,
  status,
});

describe('roomsTakenByNight', () => {
  it('counts overlapping live stays and frees the check-out night', () => {
    const stays = [
      stay('2027-01-10', '2027-01-12', 3),
      stay('2027-01-11', '2027-01-13', 2),
      stay('2027-01-10', '2027-01-13', 5, 'cancelled'),
    ];
    expect(roomsTakenByNight(stays, 'r', '2027-01-10', 4).map((n) => n.taken)).toEqual([
      3, 5, 2, 0,
    ]);
  });

  it('ignores other units', () => {
    expect(
      roomsTakenByNight(
        [{ ...stay('2027-01-10', '2027-01-11', 1), unit_id: 'x' }],
        'r',
        '2027-01-10',
        1,
      )[0]!.taken,
    ).toBe(0);
  });
});

describe('nightsBetween', () => {
  it('counts nights across month ends', () => {
    expect(nightsBetween('2027-01-30', '2027-02-02')).toBe(3);
  });
});
