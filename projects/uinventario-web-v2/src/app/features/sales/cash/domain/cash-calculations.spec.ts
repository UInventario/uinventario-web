import { describe, expect, it } from 'vitest';
import { cashDifference, denominationTotal, moneyCents } from './cash-calculations';

describe('cash calculations', () => {
  it('adds denomination counts without floating point errors', () => {
    expect(
      denominationTotal([
        { denomination: '200.00', quantity: 2 },
        { denomination: '0.50', quantity: 3 },
      ]),
    ).toBe('401.50');
  });

  it('calculates shortages and rejects invalid money', () => {
    expect(cashDifference('399.90', '395.00')).toBe('-4.90');
    expect(moneyCents('-1')).toBeNull();
    expect(moneyCents('1.999')).toBeNull();
  });
});
