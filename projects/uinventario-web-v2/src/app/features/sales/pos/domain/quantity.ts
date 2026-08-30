import { PosProduct } from './pos.models';

const QUANTITY_PATTERN = /^(0|[1-9]\d{0,8})(?:\.(\d{1,3}))?$/;

export function quantityUnits(value: string): number | null {
  const match = QUANTITY_PATTERN.exec(value.trim());
  if (!match) return null;
  const fraction = (match[2] ?? '').padEnd(3, '0');
  return Number(match[1]) * 1000 + Number(fraction);
}

export function quantityFromUnits(units: number): string {
  const whole = Math.floor(units / 1000);
  const fraction = String(units % 1000).padStart(3, '0');
  return `${whole}.${fraction}`;
}

export function normalizeQuantity(value: string, product: PosProduct): string | null {
  const trimmed = value.trim();
  const match = QUANTITY_PATTERN.exec(trimmed);
  const units = quantityUnits(trimmed);
  const minimum = quantityUnits(product.minimumQuantity);
  if (
    !match ||
    units === null ||
    minimum === null ||
    units < minimum ||
    (match[2]?.length ?? 0) > product.quantityPrecision
  ) {
    return null;
  }
  return quantityFromUnits(units);
}

export function changeQuantity(current: string, product: PosProduct, direction: -1 | 1): string {
  const currentUnits = quantityUnits(current) ?? 0;
  const step = quantityUnits(product.minimumQuantity) ?? 1000;
  return quantityFromUnits(Math.max(step, currentUnits + direction * step));
}
