import { ProductBaseUnit, QuantityRoundingMode } from '../catalog/product-api.service';

export interface QuantityPolicyLike {
  baseUnit?: ProductBaseUnit;
  quantityPrecision?: number;
  quantityRounding?: QuantityRoundingMode;
  minimumQuantity?: string;
}

export function quantityUnits(value: string): bigint {
  const [whole, fraction = ''] = value.trim().split('.');
  return BigInt(whole || '0') * 1000n + BigInt(fraction.padEnd(3, '0'));
}

export function quantityFromUnits(value: bigint): string {
  return `${value / 1000n}.${String(value % 1000n).padStart(3, '0')}`;
}

export function quantityStep(precision = 3): string {
  return ['1', '0.1', '0.01', '0.001'][precision] ?? '0.001';
}

export function normalizeQuantity(value: string, policy: QuantityPolicyLike): string {
  const precision = policy.quantityPrecision ?? 3;
  const quantum = [1000n, 100n, 10n, 1n][precision] ?? 1n;
  const input = quantityUnits(value);
  const quotient = input / quantum;
  const remainder = input % quantum;
  const mode = policy.quantityRounding ?? 'HALF_UP';
  const increment =
    remainder === 0n
      ? 0n
      : mode === 'UP' || (mode === 'HALF_UP' && remainder * 2n >= quantum)
        ? 1n
        : 0n;
  const normalized = (quotient + increment) * quantum;
  if (normalized < quantityUnits(policy.minimumQuantity ?? '0.001')) {
    throw new Error(
      `La cantidad m\u00ednima es ${policy.minimumQuantity ?? '0.001'} ${policy.baseUnit ?? 'UNIT'}.`,
    );
  }
  return quantityFromUnits(normalized);
}
