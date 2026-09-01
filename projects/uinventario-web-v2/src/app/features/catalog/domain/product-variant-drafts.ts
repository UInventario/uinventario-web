import { Product, ProductVariantAttribute } from './catalog.models';

const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{3,63}$/;
const MONEY_PATTERN = /^(0|[1-9]\d{0,11})(\.\d{1,2})?$/;

export interface VariantAttributeDraft {
  readonly name: string;
  readonly valuesText: string;
}

export interface ProductVariantDraft {
  readonly key: string;
  readonly id?: string;
  readonly version?: number;
  readonly values: readonly string[];
  readonly sku: string;
  readonly barcode: string;
  readonly cost: string;
  readonly price: string;
  readonly active: boolean;
}

export type ParsedVariantAttributes =
  | { readonly attributes: readonly ProductVariantAttribute[]; readonly error: null }
  | { readonly attributes: null; readonly error: string };

export function parseVariantAttributes(
  drafts: readonly VariantAttributeDraft[],
): ParsedVariantAttributes {
  if (drafts.length < 1 || drafts.length > 3) {
    return failure('Configura entre 1 y 3 atributos.');
  }
  const attributes: ProductVariantAttribute[] = [];
  const names = new Set<string>();
  for (const draft of drafts) {
    const name = draft.name.trim();
    if (!name || name.length > 40)
      return failure('Cada atributo necesita un nombre de hasta 40 caracteres.');
    const normalizedName = normalize(name);
    if (names.has(normalizedName)) return failure('Los nombres de atributo no pueden repetirse.');
    names.add(normalizedName);

    const values = draft.valuesText
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (values.length < 1 || values.length > 20) {
      return failure(`El atributo ${name} debe tener entre 1 y 20 valores.`);
    }
    if (values.some((value) => value.length > 40)) {
      return failure(`Los valores de ${name} deben tener hasta 40 caracteres.`);
    }
    const normalizedValues = values.map(normalize);
    if (new Set(normalizedValues).size !== normalizedValues.length) {
      return failure(`El atributo ${name} contiene valores repetidos.`);
    }
    attributes.push({ name, values });
  }
  const combinations = attributes.reduce((total, attribute) => total * attribute.values.length, 1);
  if (combinations > 100) return failure('La configuración supera el máximo de 100 variantes.');
  return { attributes, error: null };
}

export function buildVariantDrafts(
  parent: Product,
  attributes: readonly ProductVariantAttribute[],
  previous: readonly ProductVariantDraft[] = [],
): readonly ProductVariantDraft[] {
  const preserved = new Map(previous.map((variant) => [variant.key, variant]));
  for (const variant of parent.variants ?? []) {
    const values = attributes.map(
      (attribute) =>
        variant.variantValues?.find(
          (item) => normalize(item.attribute) === normalize(attribute.name),
        )?.value ?? '',
    );
    if (values.every(Boolean)) {
      const key = variantKey(values);
      if (!preserved.has(key)) {
        preserved.set(key, {
          key,
          id: variant.id,
          version: variant.version,
          values,
          sku: variant.sku,
          barcode: variant.barcode ?? '',
          cost: variant.cost,
          price: variant.price,
          active: variant.active,
        });
      }
    }
  }
  return cartesian(attributes.map((attribute) => attribute.values)).map((values) => {
    const key = variantKey(values);
    return (
      preserved.get(key) ?? {
        key,
        values,
        sku: generatedSku(parent.sku, values),
        barcode: '',
        cost: parent.cost,
        price: parent.price,
        active: true,
      }
    );
  });
}

export function variantDraftsError(
  attributes: readonly ProductVariantAttribute[],
  variants: readonly ProductVariantDraft[],
): string | null {
  const expected = new Set(
    cartesian(attributes.map((attribute) => attribute.values)).map(variantKey),
  );
  if (variants.length !== expected.size || variants.some((variant) => !expected.has(variant.key))) {
    return 'Los atributos cambiaron. Genera nuevamente las combinaciones.';
  }
  const skus = new Set<string>();
  const codes = new Set<string>();
  for (const variant of variants) {
    const sku = variant.sku.trim().toUpperCase();
    const code = variant.barcode.trim().toUpperCase();
    if (!SKU_PATTERN.test(sku))
      return `El SKU de ${variant.values.join(' / ')} no tiene un formato válido.`;
    if (skus.has(sku)) return `El SKU ${sku} está repetido.`;
    skus.add(sku);
    if (code && !CODE_PATTERN.test(code))
      return `El código de ${variant.values.join(' / ')} no tiene un formato válido.`;
    if (code && codes.has(code)) return `El código ${variant.barcode.trim()} está repetido.`;
    if (code) codes.add(code);
    if (!MONEY_PATTERN.test(variant.cost.trim()) || !MONEY_PATTERN.test(variant.price.trim())) {
      return `Revisa costo y precio de ${variant.values.join(' / ')}.`;
    }
  }
  return null;
}

export function variantKey(values: readonly string[]): string {
  return values.map(normalize).join('\u0000');
}

function cartesian(groups: readonly (readonly string[])[]): readonly (readonly string[])[] {
  return groups.reduce<readonly (readonly string[])[]>(
    (combinations, values) =>
      combinations.flatMap((combination) => values.map((value) => [...combination, value])),
    [[]],
  );
}

function generatedSku(parentSku: string, values: readonly string[]): string {
  const suffix = values.map(slug).filter(Boolean).join('-');
  const prefix = slug(parentSku) || 'PRODUCTO';
  return `${prefix}-${suffix || 'VAR'}`.slice(0, 40).replace(/[-._]+$/, '');
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '');
}

function normalize(value: string): string {
  return value.normalize('NFKC').trim().toUpperCase();
}

function failure(error: string): ParsedVariantAttributes {
  return { attributes: null, error };
}
