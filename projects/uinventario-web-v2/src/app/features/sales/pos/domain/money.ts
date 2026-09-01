const MONEY_PATTERN = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

export function toCents(value: string): number | null {
  const normalized = value.trim();
  if (!MONEY_PATTERN.test(normalized)) return null;
  const [whole, decimal = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function fromCents(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid money value.');
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`;
}

export function changeFor(total: string, received: string): string | null {
  const totalCents = toCents(total);
  const receivedCents = toCents(received);
  if (totalCents === null || receivedCents === null || receivedCents < totalCents) return null;
  return fromCents(receivedCents - totalCents);
}

export function splitPayment(
  total: string,
  cashAmount: string,
): {
  cash: string;
  remainder: string;
} | null {
  const totalCents = toCents(total);
  const cashCents = toCents(cashAmount);
  if (totalCents === null || cashCents === null || cashCents <= 0 || cashCents >= totalCents) {
    return null;
  }
  return { cash: fromCents(cashCents), remainder: fromCents(totalCents - cashCents) };
}

export function isReference(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:/-]{3,119}$/.test(value.trim());
}
