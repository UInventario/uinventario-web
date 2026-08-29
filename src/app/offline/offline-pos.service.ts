import { inject, Injectable } from '@angular/core';
import { ProductData } from '../catalog/product-api.service';
import { PosCartQuote } from '../pos/pos-api.service';
import { SessionApiService } from '../auth/session-api.service';
import { OfflineBootstrapEntity, OfflinePosPolicyData } from './offline-bootstrap-api.service';
import { OfflineScopeIdentity, OfflineStoreService } from './offline-store.service';

interface OfflineProduct extends OfflineBootstrapEntity {
  sku: string;
  barcode: string | null;
  name: string;
  price: string;
  active: boolean;
  categoryId: string | null;
  brandId: string | null;
}

interface OfflineLocation extends OfflineBootstrapEntity {
  warehouseId: string;
  active: boolean;
}

interface OfflineAvailability extends OfflineBootstrapEntity {
  productId: string;
  locationId: string;
  availableQuantity: string;
}

interface OfflinePriceList extends OfflineBootstrapEntity {
  name: string;
  currency: string;
  branchId: string | null;
  customerId: string | null;
  channel: 'POS' | 'WEB' | 'MOBILE' | 'DESKTOP' | null;
  priority: number;
  validFrom: string;
  validTo: string | null;
  active: boolean;
  items: Array<{ productId: string; price: string }>;
}

export class OfflinePosError extends Error {
  constructor(
    readonly code: 'OFFLINE_POS_NOT_PREPARED' | 'INSUFFICIENT_OFFLINE_STOCK' | 'OFFLINE_DATA_STALE',
    message: string,
  ) {
    super(message);
  }
}

@Injectable({ providedIn: 'root' })
export class OfflinePosService {
  private readonly store = inject(OfflineStoreService);
  private readonly sessions = inject(SessionApiService);

  async search(
    query: string,
    filters: { categoryId?: string; brandId?: string } = {},
  ): Promise<ProductData[]> {
    const scope = await this.scope();
    const freshness = await this.store.freshness(scope);
    if (!freshness.catalogReadable) {
      throw new OfflinePosError(
        'OFFLINE_DATA_STALE',
        'El catálogo offline venció. Conéctate para actualizarlo.',
      );
    }
    const products = await this.store.entities<OfflineProduct>(scope, 'PRODUCT');
    const value = query.trim().toLocaleLowerCase();
    return products
      .filter(
        ({ active, name, sku, barcode, categoryId, brandId }) =>
          active &&
          (!filters.categoryId || categoryId === filters.categoryId) &&
          (!filters.brandId || brandId === filters.brandId) &&
          [name, sku, barcode ?? ''].some((candidate) =>
            candidate.toLocaleLowerCase().includes(value),
          ),
      )
      .slice(0, 5)
      .map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        trackLots: false,
        category: null,
        brand: null,
        cost: '0.00',
        price: product.price,
        active: product.active,
        version: product.version,
      }));
  }

  async quote(
    lines: Array<{ productId: string; quantity: string }>,
    customerId?: string,
  ): Promise<PosCartQuote> {
    const scope = await this.scope();
    await this.store.assertAction(scope, 'CASH_SALE');
    const [policies, products, priceLists, locations, availability, outbox] = await Promise.all([
      this.store.entities<OfflinePosPolicyData>(scope, 'POS_POLICY'),
      this.store.entities<OfflineProduct>(scope, 'PRODUCT'),
      this.store.entities<OfflinePriceList>(scope, 'PRICE_LIST'),
      this.store.entities<OfflineLocation>(scope, 'LOCATION'),
      this.store.entities<OfflineAvailability>(scope, 'INVENTORY_AVAILABILITY'),
      this.store.outbox(scope),
    ]);
    const policy = policies.find(
      (item) => item.branchId === scope.branchId && item.cashRegisterId === scope.cashRegisterId,
    );
    const session = this.sessions.session();
    if (
      !policy ||
      !session?.context.branch ||
      !session.context.warehouse ||
      !session.context.cashRegister
    ) {
      throw new OfflinePosError(
        'OFFLINE_POS_NOT_PREPARED',
        'Prepara los datos offline con una caja abierta antes de vender sin conexión.',
      );
    }
    const productMap = new Map(products.map((product) => [product.id, product]));
    const locationIds = new Set(
      locations
        .filter(({ warehouseId, active }) => active && warehouseId === policy.warehouseId)
        .map(({ id }) => id),
    );
    const pending = this.pendingQuantities(outbox);
    const prices = this.resolvePrices(
      priceLists,
      lines.map(({ productId }) => productId),
      policy.currency,
      policy.branchId,
      customerId,
    );
    const taxBasisPoints = this.rateUnits(policy.taxRate);
    let subtotalCents = 0n;
    let taxCents = 0n;
    let totalCents = 0n;
    const quoteLines = lines.map(({ productId, quantity }) => {
      const product = productMap.get(productId);
      if (!product?.active) {
        throw new OfflinePosError(
          'OFFLINE_POS_NOT_PREPARED',
          'El producto no está disponible offline.',
        );
      }
      const quantityUnits = this.quantityUnits(quantity);
      const availableUnits = availability
        .filter((balance) => balance.productId === productId && locationIds.has(balance.locationId))
        .reduce((total, balance) => total + this.quantityUnits(balance.availableQuantity), 0n);
      const effectiveAvailable = availableUnits - (pending.get(productId) ?? 0n);
      if (quantityUnits > effectiveAvailable) {
        throw new OfflinePosError(
          'INSUFFICIENT_OFFLINE_STOCK',
          `Stock offline insuficiente para ${product.name}; no se permite sobreventa.`,
        );
      }
      const resolvedPrice = prices.get(productId);
      const effectivePrice = resolvedPrice?.price ?? product.price;
      const lineTotal = this.roundDivide(this.moneyCents(effectivePrice) * quantityUnits, 1000n);
      const lineTax =
        taxBasisPoints === 0n
          ? 0n
          : this.roundDivide(lineTotal * taxBasisPoints, 10_000n + taxBasisPoints);
      const lineSubtotal = lineTotal - lineTax;
      subtotalCents += lineSubtotal;
      taxCents += lineTax;
      totalCents += lineTotal;
      return {
        product: { id: product.id, name: product.name, sku: product.sku },
        quantity: this.quantity(quantityUnits),
        lotId: null,
        availableQuantity: this.quantity(effectiveAvailable),
        unitPrice: this.money(this.moneyCents(effectivePrice)),
        priceSource: resolvedPrice ? ('PRICE_LIST' as const) : ('BASE' as const),
        priceList: resolvedPrice ? { id: resolvedPrice.id, name: resolvedPrice.name } : null,
        grossTotal: this.money(lineTotal),
        discount: { line: null, sale: null, total: '0.00' },
        subtotal: this.money(lineSubtotal),
        tax: this.money(lineTax),
        total: this.money(lineTotal),
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
      discount: null,
      lines: quoteLines,
      totals: {
        gross: this.money(totalCents),
        lineDiscount: '0.00',
        saleDiscount: '0.00',
        discount: '0.00',
        subtotal: this.money(subtotalCents),
        tax: this.money(taxCents),
        total: this.money(totalCents),
      },
    };
  }

  private resolvePrices(
    lists: OfflinePriceList[],
    productIds: string[],
    currency: string,
    branchId: string,
    customerId?: string,
  ): Map<string, { id: string; name: string; price: string }> {
    const now = Date.now();
    const productSet = new Set(productIds);
    const candidates = lists
      .filter(
        (list) =>
          list.active &&
          list.currency === currency &&
          new Date(list.validFrom).getTime() <= now &&
          (!list.validTo || new Date(list.validTo).getTime() > now) &&
          (!list.branchId || list.branchId === branchId) &&
          (!list.customerId || list.customerId === customerId) &&
          (!list.channel || list.channel === 'POS'),
      )
      .sort(
        (left, right) =>
          right.priority - left.priority ||
          this.specificity(right) - this.specificity(left) ||
          new Date(right.validFrom).getTime() - new Date(left.validFrom).getTime() ||
          left.id.localeCompare(right.id),
      );
    const resolved = new Map<string, { id: string; name: string; price: string }>();
    for (const list of candidates) {
      for (const item of list.items) {
        if (productSet.has(item.productId) && !resolved.has(item.productId)) {
          resolved.set(item.productId, { id: list.id, name: list.name, price: item.price });
        }
      }
    }
    return resolved;
  }

  private specificity(list: OfflinePriceList): number {
    return (
      Number(Boolean(list.branchId)) +
      Number(Boolean(list.customerId)) +
      Number(Boolean(list.channel))
    );
  }

  async queueCashSale(
    quote: PosCartQuote,
    input: {
      lines: Array<{ productId: string; quantity: string }>;
      cashReceived: string;
      customerId?: string;
    },
    idempotencyKey: string,
  ) {
    const scope = await this.scope();
    await this.store.assertAction(scope, 'CASH_SALE');
    const received = this.moneyCents(input.cashReceived);
    if (received < this.moneyCents(quote.totals.total)) {
      throw new Error('El efectivo recibido no cubre el total de la venta.');
    }
    return this.store.queue(
      scope,
      'CASH_SALE',
      {
        ...input,
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
      },
      { idempotencyKey },
    );
  }

  private pendingQuantities(
    commands: Awaited<ReturnType<OfflineStoreService['outbox']>>,
  ): Map<string, bigint> {
    const quantities = new Map<string, bigint>();
    for (const command of commands) {
      if (
        command.kind !== 'CASH_SALE' ||
        command.status === 'CONFIRMED' ||
        (command.status === 'ERROR' && !command.retryable)
      ) {
        continue;
      }
      const lines = Array.isArray(command.payload['lines'])
        ? (command.payload['lines'] as Array<Record<string, unknown>>)
        : [];
      for (const line of lines) {
        if (typeof line['productId'] !== 'string' || typeof line['quantity'] !== 'string') continue;
        quantities.set(
          line['productId'],
          (quantities.get(line['productId']) ?? 0n) + this.quantityUnits(line['quantity']),
        );
      }
    }
    return quantities;
  }

  private async scope(): Promise<OfflineScopeIdentity> {
    const session = this.sessions.session();
    if (!session) throw new Error('La sesión ya no está disponible.');
    return {
      tenantId: session.tenant.id,
      userId: session.user.id,
      deviceId: await this.store.deviceId(),
      branchId: session.context.branch?.id ?? null,
      cashRegisterId: session.context.cashRegister?.id ?? null,
    };
  }

  private moneyCents(value: string): bigint {
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  }

  private quantityUnits(value: string): bigint {
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0'));
  }

  private rateUnits(value: string): bigint {
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, '0'));
  }

  private money(value: bigint): string {
    return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
  }

  private quantity(value: bigint): string {
    return `${value / 1000n}.${String(value % 1000n).padStart(3, '0')}`;
  }

  private roundDivide(numerator: bigint, denominator: bigint): bigint {
    return (numerator + denominator / 2n) / denominator;
  }
}
