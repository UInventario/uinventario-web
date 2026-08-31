import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../api/api-error';
import { SessionData } from '../session/session.models';
import { SessionState } from '../session/session-state';
import { OfflineApi } from './offline-api';
import { OfflineBootstrap, OfflineChanges, OfflineEntity, OfflineScope } from './offline.models';
import { OfflineStore } from './offline-store';
import { OfflineSync } from './offline-sync';

describe('OfflineSync', () => {
  const session = activeSession();
  const api = { bootstrap: vi.fn(), changes: vi.fn(), commands: vi.fn() };
  const sessions = { session: () => session, accept: vi.fn() };
  let store: OfflineStore;
  let sync: OfflineSync;
  let current: OfflineScope;

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        OfflineSync,
        OfflineStore,
        { provide: OfflineApi, useValue: api },
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
    sync = TestBed.inject(OfflineSync);
    sync.online.set(true);
  });

  afterEach(async () => store.clearAll());

  it('downloads every bootstrap page and stores the versioned initial cursor atomically', async () => {
    api.bootstrap.mockImplementation((_deviceId: string, cursor?: string) =>
      of(
        cursor
          ? bootstrap(current, {
              complete: true,
              nextCursor: null,
              entities: [entity(current, 'PRODUCT', 'product-2')],
            })
          : bootstrap(current, {
              complete: false,
              nextCursor: 'bootstrap-page-2',
              entities: [entity(current, 'PRODUCT', 'product-1')],
            }),
      ),
    );

    await sync.prepare();

    expect(api.bootstrap).toHaveBeenNthCalledWith(1, current.deviceId, undefined);
    expect(api.bootstrap).toHaveBeenNthCalledWith(2, current.deviceId, 'bootstrap-page-2');
    expect(await store.record(current)).toMatchObject({
      cursor: 'sync-cursor-1',
      entities: [{ id: 'product-1' }, { id: 'product-2' }],
    });
    expect(sync.summary()).toMatchObject({ prepared: true, entities: 2 });
  });

  it('rejects a bootstrap whose tenant or operating context differs from the session', async () => {
    api.bootstrap.mockReturnValue(
      of(bootstrap({ ...current, tenantId: 'another-tenant' }, { complete: true })),
    );

    await expect(sync.prepare()).rejects.toThrow('contexto autorizado cambió');
    await expect(store.record(current)).resolves.toBeNull();
  });

  it('turns causal command conflicts into explicit user-resolvable queue items', async () => {
    await store.replaceBootstrap(bootstrap(current, { complete: true }), [], session);
    const command = await sync.queue('INVENTORY_MOVEMENT', {
      productId: 'product-1',
      locationId: 'location-1',
      type: 'ENTRY',
      quantity: '1.000',
      reason: 'Entrada',
      reference: 'OFF-1',
    });
    api.commands.mockReturnValue(
      throwError(
        () =>
          new ApiError(
            'conflict',
            'La secuencia no coincide.',
            409,
            'OFFLINE_COMMAND_SEQUENCE_GAP',
            'request-1',
            true,
          ),
      ),
    );
    api.changes.mockReturnValue(of(changes(current)));

    await sync.synchronize(true);

    expect(sync.summary()).toMatchObject({ pending: 0, conflicts: 1 });
    expect(sync.commands()).toMatchObject([
      {
        commandId: command.commandId,
        status: 'ERROR',
        retryable: false,
        error: { code: 'OFFLINE_COMMAND_SEQUENCE_GAP' },
      },
    ]);
    expect(sessions.accept).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ user: session.user }) }),
    );
  });
});

function activeSession(): SessionData {
  return {
    user: {
      id: 'user-1',
      email: 'admin@example.com',
      roles: ['ADMIN'],
      permissions: ['INVENTORY_ADJUST'],
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

function bootstrap(
  current: OfflineScope,
  page: Partial<OfflineBootstrap['page']>,
): OfflineBootstrap {
  const now = new Date().toISOString();
  return {
    protocolVersion: '1.0',
    generatedAt: now,
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
    page: {
      initialSyncCursor: 'sync-cursor-1',
      nextCursor: null,
      complete: true,
      entities: [],
      ...page,
    },
  };
}

function changes(current: OfflineScope): OfflineChanges {
  return {
    generatedAt: new Date().toISOString(),
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
      user: { id: current.userId, roles: ['ADMIN'], permissions: ['INVENTORY_ADJUST'] },
    },
    nextCursor: 'sync-cursor-2',
    hasMore: false,
    changes: [],
  };
}

function entity(current: OfflineScope, kind: string, id: string): OfflineEntity {
  return {
    kind,
    id,
    tenantId: current.tenantId,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
}
