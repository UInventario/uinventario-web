import { normalizeQuantity, quantityFromUnits, quantityUnits } from './quantity-policy';

describe('quantity policy', () => {
  it('uses fixed decimal units for conversions', () => {
    expect(quantityUnits('0.125')).toBe(125n);
    expect(quantityFromUnits(1240n)).toBe('1.240');
  });

  it('matches the server rounding policy', () => {
    expect(
      normalizeQuantity('1.235', {
        baseUnit: 'KILOGRAM',
        quantityPrecision: 2,
        quantityRounding: 'HALF_UP',
        minimumQuantity: '0.250',
      }),
    ).toBe('1.240');
  });

  it('rejects a value below the product minimum', () => {
    expect(() =>
      normalizeQuantity('0.100', {
        quantityPrecision: 3,
        minimumQuantity: '0.250',
      }),
    ).toThrow(/0\.250/);
  });
});
