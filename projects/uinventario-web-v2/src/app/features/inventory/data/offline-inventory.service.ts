import { Injectable, inject } from '@angular/core';
import { OfflineEntity, OfflineScope, scopeFor } from '../../../core/offline/offline.models';
import { OfflineStore } from '../../../core/offline/offline-store';
import { OfflineSync } from '../../../core/offline/offline-sync';
import { SessionState } from '../../../core/session/session-state';
import {
  InventoryLocation,
  InventoryMovement,
  InventoryMovementInput,
  InventoryProductDetails,
  InventoryStockItem,
  InventoryStockPage,
  StockQuery,
} from '../domain/inventory.models';

interface LocalProduct extends OfflineEntity {
  readonly kind: 'PRODUCT';
  readonly name: string;
  readonly sku: string;
  readonly active: boolean;
  readonly baseUnit?: string;
  readonly quantityPrecision?: number;
  readonly minimumQuantity?: string;
}

interface LocalLocation extends OfflineEntity {
  readonly kind: 'LOCATION';
  readonly warehouseId: string;
  readonly name: string;
  readonly code: string;
  readonly active: boolean;
}

interface LocalAvailability extends OfflineEntity {
  readonly kind: 'INVENTORY_AVAILABILITY';
  readonly productId: string;
  readonly locationId: string;
  readonly availableQuantity: string;
}

const OFFLINE_MOVEMENT_TYPES = ['ENTRY', 'EXIT', 'RETURN', 'LOSS', 'DAMAGE'] as const;

@Injectable({ providedIn: 'root' })
export class OfflineInventory {
  private readonly store = inject(OfflineStore);
  private readonly sync = inject(OfflineSync);
  private readonly sessions = inject(SessionState);

  async listStock(query: StockQuery): Promise<InventoryStockPage> {
    const scope = await this.scope();
    const record = await this.freshRecord(scope);
    const session = this.sessions.session();
    if (!session?.context.branch || !session.context.warehouse)
      throw new Error('Selecciona una sucursal y bodega.');
    const locations = (await this.store.entities<LocalLocation>(scope, 'LOCATION')).filter(
      ({ warehouseId, active }) => active && warehouseId === session.context.warehouse?.id,
    );
    const locationIds = new Set(locations.map(({ id }) => id));
    const availability = await this.store.entities<LocalAvailability>(
      scope,
      'INVENTORY_AVAILABILITY',
    );
    const pending = pendingDeltas(record.commands);
    const search = query.q?.trim().toLocaleLowerCase() ?? '';
    const all = (await this.store.entities<LocalProduct>(scope, 'PRODUCT'))
      .filter(
        ({ name, sku }) =>
          !search || [name, sku].some((value) => value.toLocaleLowerCase().includes(search)),
      )
      .map((product): InventoryStockItem => {
        const base = availability
          .filter((item) => item.productId === product.id && locationIds.has(item.locationId))
          .reduce((sum, item) => sum + units(item.availableQuantity), 0n);
        const available = base + (pending.get(product.id) ?? 0n);
        return {
          product: {
            id: product.id,
            name: product.name,
            sku: product.sku,
            active: product.active,
            trackLots: false,
            baseUnit: product.baseUnit ?? 'UNIT',
            quantityPrecision: product.quantityPrecision ?? 3,
            minimumQuantity: product.minimumQuantity ?? '0.001',
          },
          availableQuantity: quantity(available),
          totalQuantity: quantity(available),
          states: [{ code: 'AVAILABLE', quantity: quantity(available) }],
          averageUnitCost: '0.00',
          inventoryValue: '0.00',
          costing: { method: record.valuationPolicy.method, currency: 'MXN', reconciled: false },
        };
      });
    const start = (query.page - 1) * query.pageSize;
    return {
      items: all.slice(start, start + query.pageSize),
      scope: { branch: session.context.branch, warehouse: session.context.warehouse },
      currency: 'MXN',
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: all.length,
        totalPages: Math.ceil(all.length / query.pageSize),
      },
    };
  }

  async listLocations(): Promise<readonly InventoryLocation[]> {
    const scope = await this.scope();
    await this.freshRecord(scope);
    return (await this.store.entities<LocalLocation>(scope, 'LOCATION'))
      .filter(({ active }) => active)
      .map(({ id, name, code }) => ({ id, name, code }));
  }

  async getProduct(productId: string): Promise<InventoryProductDetails> {
    const scope = await this.scope();
    await this.freshRecord(scope);
    const product = (await this.store.entities<LocalProduct>(scope, 'PRODUCT')).find(
      ({ id }) => id === productId,
    );
    if (!product) throw new Error('El producto no existe en el catálogo offline vigente.');
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      active: product.active,
      trackLots: false,
      trackSerials: false,
      baseUnit: product.baseUnit ?? 'UNIT',
      quantityPrecision: product.quantityPrecision ?? 3,
    };
  }

  async createMovement(input: InventoryMovementInput): Promise<InventoryMovement> {
    if (!OFFLINE_MOVEMENT_TYPES.includes(input.type as (typeof OFFLINE_MOVEMENT_TYPES)[number])) {
      throw new Error('Este tipo de movimiento requiere conexión.');
    }
    const scope = await this.scope();
    const [product, locations, record, availability] = await Promise.all([
      this.getProduct(input.productId),
      this.store.entities<LocalLocation>(scope, 'LOCATION'),
      this.freshRecord(scope, 'INVENTORY_MOVEMENT'),
      this.store.entities<LocalAvailability>(scope, 'INVENTORY_AVAILABILITY'),
    ]);
    const location = locations.find(({ id }) => id === input.locationId);
    const session = this.sessions.session();
    if (!location || !session?.context.warehouse)
      throw new Error('La ubicación no está disponible offline.');
    const previous =
      availability
        .filter(
          (item) => item.productId === input.productId && item.locationId === input.locationId,
        )
        .reduce((sum, item) => sum + units(item.availableQuantity), 0n) +
      pendingMovementDelta(record.commands, input.productId, input.locationId);
    const direction: InventoryMovement['direction'] = ['ENTRY', 'RETURN'].includes(input.type)
      ? 'IN'
      : 'OUT';
    const delta = units(input.quantity) * (direction === 'IN' ? 1n : -1n);
    const resulting = previous + delta;
    if (resulting < 0n) throw new Error('El movimiento dejaría el saldo offline negativo.');
    const command = await this.sync.queue('INVENTORY_MOVEMENT', {
      productId: input.productId,
      locationId: input.locationId,
      type: input.type,
      quantity: input.quantity,
      reason: input.reason,
      reference: input.reference,
    });
    return {
      id: command.commandId,
      type: input.type,
      direction,
      quantityChange: quantity(delta),
      previousQuantity: quantity(previous),
      resultingQuantity: quantity(resulting),
      reason: input.reason,
      reference: input.reference,
      createdAt: command.createdAt,
      product: { id: product.id, name: product.name, sku: product.sku },
      location: {
        id: location.id,
        name: location.name,
        code: location.code,
        warehouse: session.context.warehouse,
      },
      responsible: { id: session.user.id, email: session.user.email },
      stateTransition: null,
      pendingSync: true,
    };
  }

  private async scope(): Promise<OfflineScope> {
    this.sync.markOffline();
    const session = this.sessions.session();
    if (!session) throw new Error('La sesión no está disponible.');
    return scopeFor(session, await this.store.deviceId());
  }

  private async freshRecord(
    scope: OfflineScope,
    policy: 'catalogTtlSeconds' | 'INVENTORY_MOVEMENT' = 'catalogTtlSeconds',
  ) {
    const record = await this.store.record(scope);
    if (!record) throw new Error('Prepara los datos offline antes de operar sin conexión.');
    const ttl =
      policy === 'INVENTORY_MOVEMENT'
        ? record.freshnessPolicy.actionTtlSeconds.INVENTORY_MOVEMENT
        : record.freshnessPolicy.catalogTtlSeconds;
    if (
      Date.now() - Date.parse(record.generatedAt) > ttl * 1_000 ||
      Date.now() >= Date.parse(record.sessionExpiresAt)
    )
      throw new Error('Los datos offline vencieron. Conéctate para sincronizar.');
    return record;
  }
}

function units(value: string): bigint {
  const [whole, decimals = ''] = value.split('.');
  return BigInt(whole) * 1_000n + BigInt(decimals.padEnd(3, '0').slice(0, 3));
}
function quantity(value: bigint): string {
  const sign = value < 0 ? '-' : '';
  const absolute = value < 0 ? -value : value;
  return `${sign}${absolute / 1_000n}.${String(absolute % 1_000n).padStart(3, '0')}`;
}
function pendingDeltas(
  commands: readonly {
    readonly kind: string;
    readonly status: string;
    readonly retryable: boolean;
    readonly payload: Readonly<Record<string, unknown>>;
  }[],
): Map<string, bigint> {
  const values = new Map<string, bigint>();
  for (const command of commands) {
    if (command.status === 'ERROR' && !command.retryable) continue;
    if (command.kind === 'CASH_SALE') {
      const lines = Array.isArray(command.payload['lines'])
        ? (command.payload['lines'] as ReadonlyArray<Record<string, unknown>>)
        : [];
      for (const line of lines)
        if (typeof line['productId'] === 'string' && typeof line['quantity'] === 'string')
          values.set(
            line['productId'],
            (values.get(line['productId']) ?? 0n) - units(line['quantity']),
          );
    }
    if (
      command.kind === 'INVENTORY_MOVEMENT' &&
      typeof command.payload['productId'] === 'string' &&
      typeof command.payload['quantity'] === 'string'
    ) {
      const positive = ['ENTRY', 'RETURN'].includes(String(command.payload['type']));
      const delta = units(command.payload['quantity']);
      values.set(
        command.payload['productId'],
        (values.get(command.payload['productId']) ?? 0n) + (positive ? delta : -delta),
      );
    }
  }
  return values;
}

function pendingMovementDelta(
  commands: readonly {
    readonly kind: string;
    readonly status: string;
    readonly retryable: boolean;
    readonly payload: Readonly<Record<string, unknown>>;
  }[],
  productId: string,
  locationId: string,
): bigint {
  return commands.reduce((value, command) => {
    if (
      command.kind !== 'INVENTORY_MOVEMENT' ||
      (command.status === 'ERROR' && !command.retryable) ||
      command.payload['productId'] !== productId ||
      command.payload['locationId'] !== locationId ||
      typeof command.payload['quantity'] !== 'string'
    ) {
      return value;
    }
    const delta = units(command.payload['quantity']);
    return value + (['ENTRY', 'RETURN'].includes(String(command.payload['type'])) ? delta : -delta);
  }, 0n);
}
