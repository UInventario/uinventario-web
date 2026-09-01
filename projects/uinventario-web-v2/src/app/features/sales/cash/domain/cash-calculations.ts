const MONEY = /^(0|[1-9]\d{0,12})(?:\.(\d{1,2}))?$/;

export interface DenominationCount {
  readonly denomination: string;
  readonly quantity: number;
}

export function moneyCents(value: string): bigint | null {
  const match = MONEY.exec(value.trim());
  if (!match) return null;
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}

export function centsMoney(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

export function denominationTotal(counts: readonly DenominationCount[]): string {
  const cents = counts.reduce((total, count) => {
    const denomination = moneyCents(count.denomination);
    return denomination === null || count.quantity < 0
      ? total
      : total + denomination * BigInt(count.quantity);
  }, 0n);
  return centsMoney(cents);
}

export function cashDifference(expected: string, counted: string): string | null {
  const expectedCents = moneyCents(expected);
  const countedCents = moneyCents(counted);
  return expectedCents === null || countedCents === null
    ? null
    : centsMoney(countedCents - expectedCents);
}
