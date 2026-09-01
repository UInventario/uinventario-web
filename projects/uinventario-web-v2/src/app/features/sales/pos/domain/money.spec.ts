import { describe, expect, it } from 'vitest';
import { changeFor, fromCents, isReference, splitPayment, toCents } from './money';

describe('POS money rules', () => {
  it('converts decimal values without floating-point rounding', () => {
    expect(toCents('119.90')).toBe(11990);
    expect(fromCents(11990)).toBe('119.90');
    expect(toCents('1.005')).toBeNull();
  });

  it('calculates cash change only when the tender covers the sale', () => {
    expect(changeFor('119.90', '200')).toBe('80.10');
    expect(changeFor('119.90', '100')).toBeNull();
  });

  it('creates an exact two-part mixed payment', () => {
    expect(splitPayment('119.90', '60')).toEqual({ cash: '60.00', remainder: '59.90' });
    expect(splitPayment('119.90', '119.90')).toBeNull();
    expect(splitPayment('119.90', '0')).toBeNull();
  });

  it('accepts only provider-safe references', () => {
    expect(isReference('CARD-2026/0001')).toBe(true);
    expect(isReference('bad reference')).toBe(false);
    expect(isReference('abc')).toBe(false);
  });
});
