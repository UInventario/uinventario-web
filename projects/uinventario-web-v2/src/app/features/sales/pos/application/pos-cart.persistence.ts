import { SessionData } from '../../../../core/session/session.models';
import { PosCartLine, PosProduct } from '../domain/pos.models';

const PRODUCT_UNITS = new Set([
  'UNIT',
  'KILOGRAM',
  'GRAM',
  'LITER',
  'MILLILITER',
  'METER',
  'CENTIMETER',
]);

export function cartStorageKey(session: SessionData | null): string | null {
  const context = session?.context;
  if (!session || !context?.branch || !context.warehouse || !context.cashRegister) return null;
  return [
    'uinventario:v2:pos-cart',
    session.tenant.id,
    session.user.id,
    context.branch.id,
    context.warehouse.id,
    context.cashRegister.id,
  ].join(':');
}

export function parsePersistedCart(raw: string | null): readonly PosCartLine[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.flatMap((candidate) => {
      const line = parseLine(candidate);
      return line ? [line] : [];
    });
  } catch {
    return [];
  }
}

function parseLine(value: unknown): PosCartLine | null {
  if (!isRecord(value) || !isRecord(value['product'])) return null;
  const product = parseProduct(value['product']);
  if (!product || typeof value['quantity'] !== 'string') return null;
  const note = optionalString(value['note'], 240);
  const manualUnitPrice = optionalString(value['manualUnitPrice'], 32);
  const priceOverrideReason = optionalString(value['priceOverrideReason'], 240);
  return {
    product,
    quantity: value['quantity'],
    ...(note ? { note } : {}),
    ...(manualUnitPrice ? { manualUnitPrice } : {}),
    ...(priceOverrideReason ? { priceOverrideReason } : {}),
  };
}

function parseProduct(value: Record<string, unknown>): PosProduct | null {
  const required = ['id', 'name', 'sku', 'price', 'minimumQuantity'] as const;
  if (required.some((key) => typeof value[key] !== 'string')) return null;
  if (!PRODUCT_UNITS.has(String(value['baseUnit']))) return null;
  if (
    typeof value['withoutCode'] !== 'boolean' ||
    typeof value['active'] !== 'boolean' ||
    typeof value['sellable'] !== 'boolean' ||
    typeof value['trackLots'] !== 'boolean' ||
    typeof value['trackSerials'] !== 'boolean' ||
    typeof value['quantityPrecision'] !== 'number'
  ) {
    return null;
  }
  return value as unknown as PosProduct;
}

function optionalString(value: unknown, maximum: number): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maximum) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
