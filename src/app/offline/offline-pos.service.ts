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

export class OfflinePosError extends Error {
  constructor(
    readonly code: 'OFFLINE_POS_NOT_PREPARED' | 'INSUFFICIENT_OFFLINE_STOCK',
    message: string,
  ) {
    super(message);
  }
}

@Injectable({ providedIn: 'root' })
export class OfflinePosService {
  private readonly store = inject(OfflineStoreService);
  private readonly sessions = inject(SessionApiService);

  async search(query: string): Promise<ProductData[]> {
    const products = await this.store.entities<OfflineProduct>(await this.scope(), 'PRODUCT');
    const value = query.trim().toLocaleLowerCase();
    return products
      .filter(
        ({ active, name, sku, barcode }) =>
          active &&
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
        category: null,
        brand: null,
        cost: '0.00',
        price: product.price,
        active: product.active,
        version: product.version,
      }));
  }

  async quote(lines: Array<{ productId: string; quantity: string }>): Promise<PosCartQuote> {
    const scope = await this.scope();
    const [policies, products, locations, availability, outbox] = await Promise.all([
      this.store.entities<OfflinePosPolicyData>(scope, 'POS_POLICY'),
      this.store.entities<OfflineProduct>(scope, 'PRODUCT'),
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
      const lineTotal = this.roundDivide(this.moneyCents(product.price) * quantityUnits, 1000n);
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
        availableQuantity: this.quantity(effectiveAvailable),
        unitPrice: this.money(this.moneyCents(product.price)),
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
      lines: quoteLines,
      totals: {
        subtotal: this.money(subtotalCents),
        tax: this.money(taxCents),
        total: this.money(totalCents),
      },
    };
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
    const received = this.moneyCents(input.cashReceived);
    if (received < this.moneyCents(quote.totals.total)) {
      throw new Error('El efectivo recibido no cubre el total de la venta.');
    }
    return this.store.queue(
      await this.scope(),
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
