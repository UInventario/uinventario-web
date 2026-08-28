import { TestBed } from '@angular/core/testing';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { SessionApiService } from '../auth/session-api.service';
import { OfflineBootstrapData, OfflineBootstrapEntity } from './offline-bootstrap-api.service';
import { OfflinePosService } from './offline-pos.service';
import { OfflineStoreService } from './offline-store.service';

describe('OfflinePosService', () => {
  const scope = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    deviceId: '10000000-0000-4000-8000-000000000001',
    branchId: 'branch-1',
    cashRegisterId: 'cash-1',
  };
  const session = {
    tenant: { id: 'tenant-1', name: 'Tenant' },
    user: { id: 'user-1', email: 'admin@example.com', roles: ['ADMIN'], permissions: [] },
    context: {
      branch: { id: 'branch-1', name: 'Principal' },
      warehouse: { id: 'warehouse-1', name: 'Bodega' },
      cashRegister: { id: 'cash-1', name: 'Caja', code: 'CAJA-1' },
    },
    nextStep: 'APPLICATION' as const,
  };
  let store: OfflineStoreService;
  let service: OfflinePosService;

  beforeEach(async () => {
    Object.assign(globalThis, { indexedDB: new IDBFactory(), IDBKeyRange });
    TestBed.configureTestingModule({
      providers: [
        OfflineStoreService,
        OfflinePosService,
        { provide: SessionApiService, useValue: { session: () => session } },
      ],
    });
    store = TestBed.inject(OfflineStoreService);
    service = TestBed.inject(OfflinePosService);
    const activeScope = { ...scope, deviceId: await store.deviceId() };
    const generatedAt = new Date().toISOString();
    const data: OfflineBootstrapData = {
      protocolVersion: '1.0',
      generatedAt,
      sessionExpiresAt: new Date(Date.now() + 8 * 60 * 60_000).toISOString(),
      freshnessPolicy: {
        version: 1,
        maxClockSkewSeconds: 300,
        catalogTtlSeconds: 86400,
        permissionsTtlSeconds: 3600,
        actionTtlSeconds: {
          CASH_SALE: 900,
          INVENTORY_COUNT: 14400,
          INVENTORY_MOVEMENT: 3600,
        },
      },
      scope: activeScope,
      identity: {
        tenant: { id: 'tenant-1', name: 'Tenant' },
        user: { id: 'user-1', roles: ['ADMIN'], permissions: ['SALES_MANAGE'] },
      },
      posPolicy: {
        kind: 'POS_POLICY',
        id: 'shift-1',
        tenantId: 'tenant-1',
        version: 1,
        updatedAt: generatedAt,
        branchId: 'branch-1',
        warehouseId: 'warehouse-1',
        cashRegisterId: 'cash-1',
        shiftId: 'shift-1',
        shiftOpenedAt: '2026-08-27T20:00:00.000Z',
        currency: 'MXN',
        taxRate: '0.1600',
        paymentMethods: ['CASH'],
        negativeStock: 'DENY',
      },
      page: {
        initialSyncCursor: 'cursor',
        cursor: 'cursor',
        nextCursor: null,
        complete: true,
        entities: entities() as OfflineBootstrapEntity[],
      },
    };
    await store.replaceBootstrap(data, data.page.entities);
  });

  it('searches and quotes from the authorized price, tax and stock snapshot', async () => {
    await expect(service.search('off-1')).resolves.toEqual([
      expect.objectContaining({ id: 'product-1', name: 'Producto offline', price: '116.00' }),
    ]);

    const quote = await service.quote([{ productId: 'product-1', quantity: '2' }]);

    expect(quote).toMatchObject({
      currency: 'MXN',
      taxRate: '0.1600',
      lines: [
        {
          quantity: '2.000',
          availableQuantity: '3.000',
          unitPrice: '116.00',
          subtotal: '200.00',
          tax: '32.00',
          total: '232.00',
        },
      ],
      totals: { subtotal: '200.00', tax: '32.00', total: '232.00' },
    });
    const command = await service.queueCashSale(
      quote,
      { lines: [{ productId: 'product-1', quantity: '2' }], cashReceived: '250.00' },
      'web-sale-global-idempotency',
    );
    expect(command).toMatchObject({
      sequence: 1,
      kind: 'CASH_SALE',
      idempotencyKey: 'web-sale-global-idempotency',
      status: 'PENDING',
      payload: {
        snapshot: {
          cashRegisterId: 'cash-1',
          paymentMethod: 'CASH',
          negativeStock: 'DENY',
          totals: { total: '232.00' },
        },
      },
    });
  });

  it('subtracts pending local sales and refuses offline overselling', async () => {
    const quote = await service.quote([{ productId: 'product-1', quantity: '2' }]);
    await service.queueCashSale(
      quote,
      { lines: [{ productId: 'product-1', quantity: '2' }], cashReceived: '232.00' },
      'web-sale-first-device-command',
    );

    await expect(service.quote([{ productId: 'product-1', quantity: '2' }])).rejects.toMatchObject({
      code: 'INSUFFICIENT_OFFLINE_STOCK',
    });
  });

  function entities(): Array<OfflineBootstrapEntity & Record<string, unknown>> {
    const base = { tenantId: 'tenant-1', version: 1, updatedAt: '2026-08-27T20:00:00.000Z' };
    return [
      {
        ...base,
        kind: 'LOCATION',
        id: 'location-1',
        warehouseId: 'warehouse-1',
        active: true,
      },
      {
        ...base,
        kind: 'PRODUCT',
        id: 'product-1',
        name: 'Producto offline',
        sku: 'OFF-1',
        barcode: '750000000001',
        price: '116.00',
        active: true,
      },
      {
        ...base,
        kind: 'INVENTORY_AVAILABILITY',
        id: 'balance-1',
        productId: 'product-1',
        locationId: 'location-1',
        availableQuantity: '3.000',
      },
    ];
  }
});
