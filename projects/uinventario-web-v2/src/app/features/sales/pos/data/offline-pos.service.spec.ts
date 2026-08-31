import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import {
  OfflineBootstrap,
  OfflineEntity,
  OfflineScope,
} from '../../../../core/offline/offline.models';
import { OfflineStore } from '../../../../core/offline/offline-store';
import { OfflineSync } from '../../../../core/offline/offline-sync';
import { SessionData } from '../../../../core/session/session.models';
import { SessionState } from '../../../../core/session/session-state';
import { OfflinePos } from './offline-pos.service';

describe('OfflinePos', () => {
  const session = activeSession();
  const sync = { queue: vi.fn(), markOffline: vi.fn() };
  let store: OfflineStore;
  let offline: OfflinePos;
  let current: OfflineScope;

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        OfflinePos,
        OfflineStore,
        { provide: OfflineSync, useValue: sync },
        { provide: SessionState, useValue: { session: () => session } },
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
    offline = TestBed.inject(OfflinePos);
  });

  afterEach(async () => store.clearAll());

  it('quotes and queues a compliant cash sale while reserving stock locally', async () => {
    await prepare(store, current);
    const input = {
      lines: [{ productId: 'product-1', quantity: '2.000' }],
      cashReceived: '250.00',
    };

    const quote = await offline.quote(input);
    const sale = await offline.createCashSale(input);

    expect(quote).toMatchObject({
      currency: 'MXN',
      taxRate: '0.1600',
      lines: [{ availableQuantity: '5.000', unitPrice: '100.00' }],
      totals: { gross: '200.00', total: '200.00' },
    });
    expect(sale).toMatchObject({
      status: 'PENDING_SYNC',
      receiptNumber: 'PEND-1',
      payments: [{ method: 'CASH', amountApplied: '200.00', change: '50.00' }],
    });
    expect(sync.queue).toHaveBeenCalledWith(
      'CASH_SALE',
      expect.objectContaining({
        lines: [{ productId: 'product-1', quantity: '2.000' }],
        snapshot: expect.objectContaining({
          branchId: 'branch-1',
          warehouseId: 'warehouse-1',
          cashRegisterId: 'register-1',
          paymentMethod: 'CASH',
          negativeStock: 'DENY',
        }),
      }),
    );
    await expect(
      offline.quote({ lines: [{ productId: 'product-1', quantity: '4.000' }] }),
    ).rejects.toThrow('Stock offline insuficiente');
  });

  it('keeps the catalog readable but blocks sales after the cash-sale TTL expires', async () => {
    await prepare(store, current, new Date(Date.now() - 20 * 60_000).toISOString());

    await expect(offline.searchProducts('café')).resolves.toMatchObject({
      products: [{ id: 'product-1' }],
    });
    await expect(
      offline.quote({ lines: [{ productId: 'product-1', quantity: '1.000' }] }),
    ).rejects.toThrow('datos offline vencieron');
  });

  it('never degrades contextual prices, discounts or loyalty into an offline base-price sale', async () => {
    await prepare(store, current);
    await expect(
      offline.quote({
        channel: 'POS',
        customerId: 'customer-1',
        loyaltyPointsToRedeem: 100,
        discount: { type: 'PERCENT', value: '10', reason: 'Convenio mayorista' },
        lines: [{ productId: 'product-1', quantity: '1.000' }],
      }),
    ).rejects.toThrow('Conéctate para usar cliente');
  });
});

function activeSession(): SessionData {
  return {
    user: {
      id: 'user-1',
      email: 'cajero@example.com',
      roles: ['CASHIER'],
      permissions: ['SALES_MANAGE', 'INVENTORY_VIEW'],
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
      user: { id: current.userId, roles: ['CASHIER'], permissions: ['SALES_MANAGE'] },
    },
    valuationPolicy: { method: 'MOVING_AVERAGE', version: 1 },
    posPolicy: {
      kind: 'POS_POLICY',
      id: 'policy-1',
      tenantId: current.tenantId,
      version: 1,
      updatedAt: generatedAt,
      branchId: 'branch-1',
      warehouseId: 'warehouse-1',
      cashRegisterId: 'register-1',
      shiftId: 'shift-1',
      shiftOpenedAt: generatedAt,
      currency: 'MXN',
      taxRate: '0.1600',
      paymentMethods: ['CASH'],
      negativeStock: 'DENY',
    },
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
      barcode: '7500000000001',
      price: '100.00',
      active: true,
    },
    {
      ...base,
      kind: 'LOCATION',
      id: 'location-1',
      warehouseId: 'warehouse-1',
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
