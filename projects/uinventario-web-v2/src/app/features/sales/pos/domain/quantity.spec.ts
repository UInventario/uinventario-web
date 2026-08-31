import { describe, expect, it } from 'vitest';
import { PosProduct } from './pos.models';
import { changeQuantity, normalizeQuantity, quantityUnits } from './quantity';

const product = (overrides: Partial<PosProduct> = {}) =>
  ({
    id: 'product-1',
    name: 'Café',
    sku: 'CAF-1',
    barcode: null,
    withoutCode: false,
    stockBehavior: 'TRACKED',
    taxBehavior: 'STANDARD',
    baseUnit: 'KILOGRAM',
    quantityPrecision: 3,
    quantityRounding: 'HALF_UP',
    minimumQuantity: '0.250',
    trackLots: false,
    trackSerials: false,
    price: '120.00',
    active: true,
    sellable: true,
    ...overrides,
  }) satisfies PosProduct;

describe('POS quantity policy', () => {
  it('accepts canonical trailing zeroes for products sold only in whole units', () => {
    const wholeUnit = product({ quantityPrecision: 0, minimumQuantity: '1.000' });
    expect(normalizeQuantity('1.000', wholeUnit)).toBe('1.000');
    expect(normalizeQuantity('1.001', wholeUnit)).toBeNull();
  });

  it('keeps fractional quantities exact in thousandths', () => {
    expect(quantityUnits('12.345')).toBe(12345);
    expect(normalizeQuantity('0.5', product())).toBe('0.500');
    expect(changeQuantity('0.500', product(), 1)).toBe('0.750');
  });

  it('rejects values below the minimum or beyond product precision', () => {
    expect(normalizeQuantity('0.100', product())).toBeNull();
    expect(
      normalizeQuantity('1.5', product({ quantityPrecision: 0, minimumQuantity: '1.000' })),
    ).toBeNull();
    expect(changeQuantity('1.000', product({ minimumQuantity: '1.000' }), -1)).toBe('1.000');
  });
});
