import {
  buildVariantDrafts,
  parseVariantAttributes,
  variantDraftsError,
} from './product-variant-drafts';
import { Product } from './catalog.models';

const parent = {
  id: 'product-1',
  name: 'Playera',
  sku: 'PLAYERA',
  barcode: null,
  cost: '100.00',
  price: '180.00',
  variants: [],
} as unknown as Product;

describe('product variant drafts', () => {
  it('builds the exact cartesian combinations with useful defaults', () => {
    const parsed = parseVariantAttributes([
      { name: 'Color', valuesText: 'Negro, Blanco' },
      { name: 'Talla', valuesText: 'S, M' },
    ]);
    expect(parsed.error).toBeNull();
    if (!parsed.attributes) throw new Error('Expected valid attributes');
    const variants = buildVariantDrafts(parent, parsed.attributes);
    expect(variants).toHaveLength(4);
    expect(variants[0]).toMatchObject({ values: ['Negro', 'S'], sku: 'PLAYERA-NEGRO-S' });
    expect(variantDraftsError(parsed.attributes, variants)).toBeNull();
  });

  it('rejects repeated attribute values and more than 100 combinations', () => {
    expect(parseVariantAttributes([{ name: 'Color', valuesText: 'Azul, azul' }]).error).toContain(
      'repetidos',
    );
    const values = Array.from({ length: 11 }, (_, index) => `V${index}`).join(',');
    expect(
      parseVariantAttributes([
        { name: 'A', valuesText: values },
        { name: 'B', valuesText: values },
      ]).error,
    ).toContain('100');
  });

  it('detects duplicate identifiers before sending them to the API', () => {
    const attributes = [{ name: 'Color', values: ['Negro', 'Blanco'] }];
    const variants = buildVariantDrafts(parent, attributes).map((variant) => ({
      ...variant,
      sku: 'DUPLICADO',
    }));
    expect(variantDraftsError(attributes, variants)).toContain('repetido');
  });
});
