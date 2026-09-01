import { Product, ProductInput } from './catalog.models';

const QUANTITY_PATTERN = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,3})?$/;

type QuantityPolicy = Pick<
  ProductInput,
  | 'baseUnit'
  | 'quantityPrecision'
  | 'quantityRounding'
  | 'minimumQuantity'
  | 'stockBehavior'
  | 'trackLots'
  | 'trackSerials'
>;

export function productQuantityPolicyError(policy: QuantityPolicy): string | null {
  if (
    !Number.isInteger(policy.quantityPrecision) ||
    policy.quantityPrecision < 0 ||
    policy.quantityPrecision > 3
  ) {
    return 'La precisión debe ser un número entero entre 0 y 3.';
  }
  const minimum = policy.minimumQuantity.trim();
  if (!QUANTITY_PATTERN.test(minimum) || toMilliUnits(minimum) <= 0) {
    return 'La cantidad mínima debe ser mayor que cero y tener hasta 3 decimales.';
  }
  if (decimalPlaces(minimum) > policy.quantityPrecision) {
    return `La cantidad mínima debe respetar la precisión de ${policy.quantityPrecision} decimal(es).`;
  }
  if (policy.stockBehavior === 'UNTRACKED' && (policy.trackLots || policy.trackSerials)) {
    return 'Un producto sin control de stock no puede controlar lotes ni series.';
  }
  if (
    policy.trackSerials &&
    (policy.baseUnit !== 'UNIT' || policy.quantityPrecision !== 0 || toMilliUnits(minimum) !== 1000)
  ) {
    return 'Los productos con series deben usar unidad, 0 decimales y cantidad mínima 1.';
  }
  return null;
}

export function productQuantityValueError(
  product: Pick<Product, 'quantityPrecision' | 'minimumQuantity'>,
  value: string,
): string | null {
  const normalized = value.trim();
  if (!QUANTITY_PATTERN.test(normalized) || toMilliUnits(normalized) <= 0) {
    return 'Ingresa una cantidad mayor que cero y con hasta 3 decimales.';
  }
  if (decimalPlaces(normalized) > product.quantityPrecision) {
    return `Este producto admite ${product.quantityPrecision} decimal(es).`;
  }
  if (toMilliUnits(normalized) < toMilliUnits(product.minimumQuantity)) {
    return `La cantidad mínima es ${product.minimumQuantity}.`;
  }
  return null;
}

function decimalPlaces(value: string): number {
  return value.split('.')[1]?.length ?? 0;
}

function toMilliUnits(value: string): number {
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 1000 + Number(fraction.padEnd(3, '0'));
}
