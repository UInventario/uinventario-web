import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import {
  OfflineBootstrap,
  OfflineEntity,
  OfflineScope,
} from '../../../core/offline/offline.models';
import { OfflineStore } from '../../../core/offline/offline-store';
import { OfflineSync } from '../../../core/offline/offline-sync';
import { SessionData } from '../../../core/session/session.models';
import { SessionState } from '../../../core/session/session-state';
import { InventoryMovementInput } from '../domain/inventory.models';
import { OfflineInventory } from './offline-inventory.service';

describe('OfflineInventory', () => {
  const session = activeSession();
  const sessions = { session: () => session };
  const sync = { queue: vi.fn(), markOffline: vi.fn() };
  let offline: OfflineInventory;
  let store: OfflineStore;
  let current: OfflineScope;

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        OfflineInventory,
        OfflineStore,
        { provide: OfflineSync, useValue: sync },
        { provide: SessionState, useValue: sessions },
      ],
    });
    store = TestBed.inject(OfflineStore);
    await store.clearAll();
    current = {
      tenantId: session.tenant.id,
      userId: session.user.id,
      deviceId: await store.deviceId(),
      branchId: session.context.branch!.id,
      cashRegisterId: session.context.cashRegister!.id,
    };
    sync.queue.mockImplementation((kind, payload) => store.queue(current, kind, payload));
    offline = TestBed.inject(OfflineInventory);
  });

  afterEach(async () => store.clearAll());

  it('queues a supported movement and immediately reflects its local stock delta', async () => {
    await prepare(store, current);

    const movement = await offline.createMovement(movementInput('EXIT', '2.000'));
    const stock = await offline.listStock({ page: 1, pageSize: 20 });

    expect(movement).toMatchObject({
      pendingSync: true,
      direction: 'OUT',
      quantityChange: '-2.000',
      previousQuantity: '5.000',
      resultingQuantity: '3.000',
    });
    expect(sync.queue).toHaveBeenCalledWith('INVENTORY_MOVEMENT', movementInput('EXIT', '2.000'));
    expect(stock.items[0]?.availableQuantity).toBe('3.000');
  });

  it('rejects a movement that would make the known local balance negative', async () => {
    await prepare(store, current);

    await expect(offline.createMovement(movementInput('LOSS', '6.000'))).rejects.toThrow(
      'saldo offline negativo',
    );
    expect(sync.queue).not.toHaveBeenCalled();
  });

  it('allows catalog reading but blocks mutations after their shorter action TTL', async () => {
    await prepare(store, current, new Date(Date.now() - 2 * 3_600_000).toISOString());

    await expect(offline.listStock({ page: 1, pageSize: 20 })).resolves.toMatchObject({
      items: [{ availableQuantity: '5.000' }],
    });
    await expect(offline.createMovement(movementInput('ENTRY', '1.000'))).rejects.toThrow(
      'datos offline vencieron',
    );
  });
});

function activeSession(): SessionData {
  return {
    user: {
      id: 'user-1',
      email: 'admin@example.com',
      roles: ['ADMIN'],
      permissions: ['INVENTORY_VIEW', 'INVENTORY_ADJUST'],
    },
    tenant: { id: 'tenant-1', name: 'Empresa' },
    context: {
      branch: { id: 'branch-1', name: 'Centro' },
      warehouse: { id: 'warehouse-1', name: 'Principal' },
      cashRegister: { id: 'register-1', name: 'Caja', code: 'CAJA-1' },
    },
    nextStep: 'APPLICATION',
  };
}

function movementInput(type: 'ENTRY' | 'EXIT' | 'LOSS', quantity: string): InventoryMovementInput {
  return {
    productId: 'product-1',
    locationId: 'location-1',
    type,
    quantity,
    reason: 'Operación local',
    reference: 'OFF-1',
  };
}

async function prepare(
  store: OfflineStore,
  current: OfflineScope,
  generatedAt = new Date().toISOString(),
): Promise<void> {
  await store.replaceBootstrap(bootstrap(current, generatedAt), entities(current), activeSession());
}

function bootstrap(current: OfflineScope, generatedAt: string): OfflineBootstrap {
  return {
    protocolVersion: '1.0',
    generatedAt,
    sessionExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    freshnessPolicy: {
      version: 1,
      maxClockSkewSeconds: 300,
      catalogTtlSeconds: 86_400,
      permissionsTtlSeconds: 3_600,
      actionTtlSeconds: { CASH_SALE: 900, INVENTORY_COUNT: 14_400, INVENTORY_MOVEMENT: 3_600 },
    },
    scope: current,
    identity: {
      tenant: { id: current.tenantId, name: 'Empresa' },
      user: { id: current.userId, roles: ['ADMIN'], permissions: ['INVENTORY_ADJUST'] },
    },
    valuationPolicy: { method: 'MOVING_AVERAGE', version: 1 },
    posPolicy: null,
    page: { initialSyncCursor: 'cursor-1', nextCursor: null, complete: true, entities: [] },
  };
}

function entities(current: OfflineScope): OfflineEntity[] {
  const base = { tenantId: current.tenantId, version: 1, updatedAt: new Date().toISOString() };
  return [
    {
      ...base,
      kind: 'PRODUCT',
      id: 'product-1',
      name: 'Café',
      sku: 'CAFE-1',
      price: '100.00',
      active: true,
    },
    {
      ...base,
      kind: 'LOCATION',
      id: 'location-1',
      warehouseId: 'warehouse-1',
      name: 'General',
      code: 'GENERAL',
      active: true,
    },
    {
      ...base,
      kind: 'INVENTORY_AVAILABILITY',
      id: 'availability-1',
      productId: 'product-1',
      locationId: 'location-1',
      availableQuantity: '5.000',
    },
  ];
}
