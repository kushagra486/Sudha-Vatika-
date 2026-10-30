// Money is numeric(12,2) in Postgres and arrives from PostgREST as a number or string.
// Do arithmetic in paise (integers) to avoid floating point drift.

export type MoneyInput = number | string | null | undefined;

export function toPaise(value: MoneyInput): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromPaise(paise: number): number {
  return paise / 100;
}

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** "₹1,25,000" — Indian digit grouping, paise shown only when non-zero. */
export function formatINR(value: MoneyInput): string {
  return inrFormatter.format(fromPaise(toPaise(value)));
}

/** Tax on a taxable amount, rounded to the paisa. */
export function computeTax(taxable: MoneyInput, taxPercent: MoneyInput): number {
  const base = toPaise(taxable);
  const pct = Number(taxPercent ?? 0);
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return fromPaise(Math.round((base * pct) / 100));
}
