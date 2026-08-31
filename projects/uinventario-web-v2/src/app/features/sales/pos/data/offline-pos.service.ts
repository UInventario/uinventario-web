import { Injectable, inject } from '@angular/core';
import { OfflineEntity, OfflineScope, scopeFor } from '../../../../core/offline/offline.models';
import { OfflineStore } from '../../../../core/offline/offline-store';
import { OfflineSync } from '../../../../core/offline/offline-sync';
import { SessionState } from '../../../../core/session/session-state';
import {
  CashRegisterShift,
  CreateCashSaleInput,
  PosCartQuote,
  PosCartRequest,
  PosPaymentOptions,
  PosProduct,
  PosProductPage,
  PosSale,
} from '../domain/pos.models';

interface OfflineProduct extends OfflineEntity {
  readonly kind: 'PRODUCT';
  readonly sku: string;
  readonly barcode: string | null;
  readonly name: string;
  readonly price: string;
  readonly baseUnit?: PosProduct['baseUnit'];
  readonly quantityPrecision?: number;
  readonly minimumQuantity?: string;
  readonly active: boolean;
}

interface OfflineAvailability extends OfflineEntity {
  readonly kind: 'INVENTORY_AVAILABILITY';
  readonly productId: string;
  readonly locationId: string;
  readonly availableQuantity: string;
}

interface OfflineLocation extends OfflineEntity {
  readonly kind: 'LOCATION';
  readonly warehouseId: string;
  readonly active: boolean;
}

interface OfflinePosPolicy extends OfflineEntity {
  readonly kind: 'POS_POLICY';
  readonly branchId: string;
  readonly warehouseId: string;
  readonly cashRegisterId: string;
  readonly shiftId: string;
  readonly shiftOpenedAt: string;
  readonly currency: string;
  readonly taxRate: string;
  readonly negativeStock: 'DENY';
}

@Injectable({ providedIn: 'root' })
export class OfflinePos {
  private readonly store = inject(OfflineStore);
  private readonly sessions = inject(SessionState);
  private readonly sync = inject(OfflineSync);

  async searchProducts(query: string): Promise<PosProductPage> {
    const scope = await this.scope();
    await this.assertFresh(scope, 'catalogTtlSeconds');
    const value = query.trim().toLocaleLowerCase();
    const products = (await this.store.entities<OfflineProduct>(scope, 'PRODUCT'))
      .filter(
        ({ active, name, sku, barcode }) =>
          active &&
          [name, sku, barcode ?? ''].some((candidate) =>
            candidate.toLocaleLowerCase().includes(value),
          ),
      )
      .slice(0, 24)
      .map(toPosProduct);
    return {
      products,
      pagination: {
        page: 1,
        pageSize: 24,
        total: products.length,
        totalPages: products.length ? 1 : 0,
      },
    };
  }

  async resolveCode(code: string): Promise<PosProduct> {
    const scope = await this.scope();
    await this.assertFresh(scope, 'catalogTtlSeconds');
    const normalized = code.trim().toLocaleLowerCase();
    const product = (await this.store.entities<OfflineProduct>(scope, 'PRODUCT')).find(
      ({ active, sku, barcode }) =>
        active &&
        [sku, barcode ?? ''].some((candidate) => candidate.toLocaleLowerCase() === normalized),
    );
    if (!product) throw new Error('El código no existe en el catálogo offline vigente.');
    return toPosProduct(product);
  }

  async currentShift(): Promise<CashRegisterShift | null> {
    const scope = await this.scope();
    const policy = (await this.store.entities<OfflinePosPolicy>(scope, 'POS_POLICY'))[0];
    const session = this.sessions.session();
    if (!policy || !session?.context.branch || !session.context.cashRegister) return null;
    return {
      id: policy.shiftId,
      status: 'OPEN',
      branch: session.context.branch,
      cashRegister: session.context.cashRegister,
      openedBy: { id: session.user.id, email: session.user.email },
      openingAmount: '0.00',
      currency: policy.currency,
      openedAt: policy.shiftOpenedAt,
    };
  }

  paymentOptions(): PosPaymentOptions {
    this.sync.markOffline();
    return { methods: ['CASH'], nonCashProvider: 'OFFLINE' };
  }

  async quote(input: PosCartRequest): Promise<PosCartQuote> {
    const scope = await this.scope();
    const record = await this.assertFresh(scope, 'CASH_SALE');
    const session = this.sessions.session();
    const policy = (await this.store.entities<OfflinePosPolicy>(scope, 'POS_POLICY'))[0];
    if (
      !policy ||
      !session?.context.branch ||
      !session.context.warehouse ||
      !session.context.cashRegister
    ) {
      throw new Error(
        'Prepara los datos offline con una caja abierta antes de vender sin conexión.',
      );
    }
    const products = new Map(
      (await this.store.entities<OfflineProduct>(scope, 'PRODUCT')).map((product) => [
        product.id,
        product,
      ]),
    );
    const locations = new Set(
      (await this.store.entities<OfflineLocation>(scope, 'LOCATION'))
        .filter(({ warehouseId, active }) => active && warehouseId === policy.warehouseId)
        .map(({ id }) => id),
    );
    const availability = await this.store.entities<OfflineAvailability>(
      scope,
      'INVENTORY_AVAILABILITY',
    );
    const pending = pendingQuantities(record.commands);
    const taxRate = rateUnits(policy.taxRate);
    let subtotal = 0n;
    let tax = 0n;
    let total = 0n;
    const lines = input.lines.map((inputLine) => {
      const product = products.get(inputLine.productId);
      if (!product?.active)
        throw new Error('Un producto del carrito ya no está disponible offline.');
      const quantity = quantityUnits(inputLine.quantity);
      const available =
        availability
          .filter((item) => item.productId === product.id && locations.has(item.locationId))
          .reduce((sum, item) => sum + quantityUnits(item.availableQuantity), 0n) -
        (pending.get(product.id) ?? 0n);
      if (quantity > available) throw new Error(`Stock offline insuficiente para ${product.name}.`);
      const lineTotal = divide(moneyUnits(product.price) * quantity, 1_000n);
      const lineTax = taxRate ? divide(lineTotal * taxRate, 10_000n + taxRate) : 0n;
      const lineSubtotal = lineTotal - lineTax;
      subtotal += lineSubtotal;
      tax += lineTax;
      total += lineTotal;
      return {
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          withoutCode: !product.barcode,
          stockBehavior: 'TRACKED' as const,
          taxBehavior: 'STANDARD' as const,
          baseUnit: product.baseUnit ?? 'UNIT',
          quantityPrecision: product.quantityPrecision ?? 3,
          minimumQuantity: product.minimumQuantity ?? '0.001',
        },
        quantity: quantityValue(quantity),
        note: null,
        availableQuantity: quantityValue(available),
        unitPrice: moneyValue(moneyUnits(product.price)),
        priceSource: 'BASE' as const,
        priceOverrideReason: null,
        priceList: null,
        grossTotal: moneyValue(lineTotal),
        subtotal: moneyValue(lineSubtotal),
        tax: moneyValue(lineTax),
        total: moneyValue(lineTotal),
      };
    });
    return {
      context: {
        branch: session.context.branch,
        warehouse: session.context.warehouse,
        cashRegister: session.context.cashRegister,
      },
      currency: policy.currency,
      taxRate: policy.taxRate,
      lines,
      totals: {
        gross: moneyValue(total),
        lineDiscount: '0.00',
        promotionDiscount: '0.00',
        saleDiscount: '0.00',
        discount: '0.00',
        subtotal: moneyValue(subtotal),
        tax: moneyValue(tax),
        total: moneyValue(total),
      },
    };
  }

  async createCashSale(input: CreateCashSaleInput): Promise<PosSale> {
    const quote = await this.quote(input);
    if (moneyUnits(input.cashReceived) < moneyUnits(quote.totals.total))
      throw new Error('El efectivo recibido no cubre el total.');
    const command = await this.sync.queue('CASH_SALE', {
      ...input,
      lines: quote.lines.map(({ product, quantity }) => ({ productId: product.id, quantity })),
      snapshot: {
        capturedAt: new Date().toISOString(),
        branchId: quote.context.branch.id,
        warehouseId: quote.context.warehouse.id,
        cashRegisterId: quote.context.cashRegister.id,
        currency: quote.currency,
        taxRate: quote.taxRate,
        paymentMethod: 'CASH',
        negativeStock: 'DENY',
        lines: quote.lines.map((line) => ({
          productId: line.product.id,
          name: line.product.name,
          sku: line.product.sku,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          subtotal: line.subtotal,
          tax: line.tax,
          total: line.total,
        })),
        totals: quote.totals,
      },
    });
    const received = moneyUnits(input.cashReceived);
    const applied = moneyUnits(quote.totals.total);
    return {
      id: command.commandId,
      receiptNumber: `PEND-${command.sequence}`,
      status: 'PENDING_SYNC',
      currency: quote.currency,
      customer: null,
      totals: quote.totals,
      payments: [
        {
          id: `pending-${command.commandId}`,
          method: 'CASH',
          status: 'PENDING',
          amountReceived: moneyValue(received),
          amountApplied: moneyValue(applied),
          change: moneyValue(received - applied),
          reference: null,
          provider: 'OFFLINE',
          authorizationCode: null,
        },
      ],
      credit: null,
      createdAt: command.createdAt,
    };
  }

  private async scope(): Promise<OfflineScope> {
    this.sync.markOffline();
    const session = this.sessions.session();
    if (!session) throw new Error('La sesión no está disponible.');
    return scopeFor(session, await this.store.deviceId());
  }

  private async assertFresh(scope: OfflineScope, policy: 'catalogTtlSeconds' | 'CASH_SALE') {
    const record = await this.store.record(scope);
    if (!record) throw new Error('Prepara los datos offline antes de operar sin conexión.');
    const ttl =
      policy === 'CASH_SALE'
        ? record.freshnessPolicy.actionTtlSeconds.CASH_SALE
        : record.freshnessPolicy.catalogTtlSeconds;
    if (
      Date.now() - Date.parse(record.generatedAt) > ttl * 1_000 ||
      Date.now() >= Date.parse(record.sessionExpiresAt)
    ) {
      throw new Error('Los datos offline vencieron. Conéctate para sincronizar.');
    }
    return record;
  }
}

function toPosProduct(product: OfflineProduct): PosProduct {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    withoutCode: !product.barcode,
    stockBehavior: 'TRACKED',
    taxBehavior: 'STANDARD',
    baseUnit: product.baseUnit ?? 'UNIT',
    quantityPrecision: product.quantityPrecision ?? 3,
    quantityRounding: 'HALF_UP',
    minimumQuantity: product.minimumQuantity ?? '0.001',
    trackLots: false,
    trackSerials: false,
    price: product.price,
    active: product.active,
    sellable: true,
  };
}
function moneyUnits(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
}
function quantityUnits(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 1_000n + BigInt(fraction.padEnd(3, '0').slice(0, 3));
}
function rateUnits(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, '0').slice(0, 4));
}
function moneyValue(value: bigint): string {
  return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
}
function quantityValue(value: bigint): string {
  return `${value / 1_000n}.${String(value % 1_000n).padStart(3, '0')}`;
}
function divide(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}
function pendingQuantities(
  commands: readonly {
    readonly kind: string;
    readonly status: string;
    readonly retryable: boolean;
    readonly payload: Readonly<Record<string, unknown>>;
  }[],
): Map<string, bigint> {
  const result = new Map<string, bigint>();
  for (const command of commands) {
    if (command.kind !== 'CASH_SALE' || (command.status === 'ERROR' && !command.retryable))
      continue;
    const lines = Array.isArray(command.payload['lines'])
      ? (command.payload['lines'] as ReadonlyArray<Record<string, unknown>>)
      : [];
    for (const line of lines)
      if (typeof line['productId'] === 'string' && typeof line['quantity'] === 'string')
        result.set(
          line['productId'],
          (result.get(line['productId']) ?? 0n) + quantityUnits(line['quantity']),
        );
  }
  return result;
}
