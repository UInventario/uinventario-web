import { productQuantityPolicyError, productQuantityValueError } from './product-quantity-policy';

describe('product quantity policy', () => {
  const policy = {
    baseUnit: 'KILOGRAM' as const,
    quantityPrecision: 2,
    quantityRounding: 'HALF_UP' as const,
    minimumQuantity: '0.25',
    stockBehavior: 'TRACKED' as const,
    trackLots: false,
    trackSerials: false,
  };

  it('accepts a fractional policy and quantities that honor it', () => {
    expect(productQuantityPolicyError(policy)).toBeNull();
    expect(productQuantityValueError(policy, '0.50')).toBeNull();
  });

  it('rejects minimum quantities with more decimals than configured', () => {
    expect(productQuantityPolicyError({ ...policy, quantityPrecision: 1 })).toContain('precisión');
  });

  it('enforces the serial-number unit invariant', () => {
    expect(productQuantityPolicyError({ ...policy, trackSerials: true })).toContain('series');
  });

  it('rejects component quantities below the product minimum or precision', () => {
    expect(productQuantityValueError(policy, '0.10')).toContain('mínima');
    expect(productQuantityValueError(policy, '0.255')).toContain('2 decimal');
  });
});
