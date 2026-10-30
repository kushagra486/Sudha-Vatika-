// All business dates are in Asia/Kolkata. Event dates are plain `date` columns
// (YYYY-MM-DD); timestamps are timestamptz and are displayed in IST.

export const APP_TIMEZONE = 'Asia/Kolkata';

const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date in IST as YYYY-MM-DD, regardless of the device timezone. */
export function todayIST(now: Date = new Date()): string {
  return isoDateFormatter.format(now);
}

/** Add days to a YYYY-MM-DD date, returning YYYY-MM-DD. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const displayDateFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "5 Dec 2026" for a YYYY-MM-DD event date. */
export function formatEventDate(isoDate: string): string {
  return displayDateFormatter.format(new Date(`${isoDate}T00:00:00Z`));
}

const displayDateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: APP_TIMEZONE,
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

/** "5 Dec, 4:30 pm" in IST for a timestamptz. */
export function formatDateTime(value: string | Date): string {
  return displayDateTimeFormatter.format(typeof value === 'string' ? new Date(value) : value);
}

const inputPartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** timestamptz → "YYYY-MM-DDTHH:mm" in IST, for <input type="datetime-local">. */
export function toISTInputValue(value: string | Date): string {
  const parts = Object.fromEntries(
    inputPartsFormatter
      .formatToParts(typeof value === 'string' ? new Date(value) : value)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** "YYYY-MM-DDTHH:mm" typed in IST → ISO timestamp with offset. */
export function fromISTInputValue(value: string): string {
  return `${value}:00+05:30`;
}

/** An IST wall-clock time `days` from today, as an ISO timestamp. */
export function istAt(days: number, hour: number, now: Date = new Date()): string {
  const date = addDays(todayIST(now), days);
  return fromISTInputValue(`${date}T${String(hour).padStart(2, '0')}:00`);
}

export type FollowUpState = 'overdue' | 'today' | 'upcoming' | 'none';

/** Where a follow-up stands relative to today in IST. */
export function followUpState(
  value: string | null | undefined,
  now: Date = new Date(),
): FollowUpState {
  if (!value) return 'none';
  const due = todayIST(new Date(value));
  const today = todayIST(now);
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  return 'upcoming';
}
