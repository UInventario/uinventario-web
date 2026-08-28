import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { OfflineBootstrapData } from './offline-bootstrap-api.service';
import { OFFLINE_SCHEMA_VERSION, OfflineStoreService } from './offline-store.service';

describe('OfflineStoreService', () => {
  class FakeBroadcastChannel {
    static readonly channels = new Set<FakeBroadcastChannel>();
    private readonly listeners = new Set<(event: MessageEvent<string>) => void>();

    constructor(readonly name: string) {
      FakeBroadcastChannel.channels.add(this);
    }

    addEventListener(_: string, listener: (event: MessageEvent<string>) => void): void {
      this.listeners.add(listener);
    }

    postMessage(data: string): void {
      for (const channel of FakeBroadcastChannel.channels) {
        if (channel !== this && channel.name === this.name) {
          for (const listener of channel.listeners) listener({ data } as MessageEvent<string>);
        }
      }
    }
  }
  const firstScope = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    deviceId: '10000000-0000-4000-8000-000000000001',
    branchId: 'branch-1',
    cashRegisterId: null,
  };

  beforeEach(() => {
    Object.assign(globalThis, {
      indexedDB: new IDBFactory(),
      IDBKeyRange,
      BroadcastChannel: FakeBroadcastChannel as unknown as typeof BroadcastChannel,
    });
    FakeBroadcastChannel.channels.clear();
  });

  it('persists a versioned bootstrap across service instances and clears it on logout', async () => {
    expect(OFFLINE_SCHEMA_VERSION).toBe(3);
    const store = new OfflineStoreService();
    const deviceId = await store.deviceId();
    const bootstrap = response(firstScope);
    await store.replaceBootstrap(bootstrap, bootstrap.page.entities);

    const afterReload = new OfflineStoreService();
    expect(await afterReload.deviceId()).toBe(deviceId);
    expect(await afterReload.summary(firstScope)).toEqual(
      expect.objectContaining({ entities: 2, generatedAt: bootstrap.generatedAt }),
    );
    await afterReload.clearAll();
    expect(await afterReload.summary(firstScope)).toBeNull();
  });

  it('removes incompatible identities and keeps outbox commands scope-isolated', async () => {
    const store = new OfflineStoreService();
    await store.replaceBootstrap(response(firstScope), response(firstScope).page.entities);
    await store.queue(firstScope, 'CASH_SALE', { total: '10.00' });
    const afterReload = new OfflineStoreService();
    expect(await afterReload.pending(firstScope)).toHaveLength(1);

    const otherScope = { ...firstScope, tenantId: 'tenant-2' };
    await store.replaceBootstrap(response(otherScope), response(otherScope).page.entities);
    expect(await store.summary(firstScope)).toBeNull();
    expect(await store.pending(firstScope)).toEqual([]);
    expect(await store.summary(otherScope)).toEqual(expect.objectContaining({ entities: 2 }));
  });

  it('rejects reusable credentials in pending command payloads', async () => {
    const store = new OfflineStoreService();
    await expect(
      store.queue(firstScope, 'CASH_SALE', {
        authorizationToken: 'must-not-be-stored',
      }),
    ).rejects.toMatchObject({ code: 'WRITE_FAILED' });
  });

  it('allocates causal sequences and persists command delivery states', async () => {
    const store = new OfflineStoreService();
    await store.replaceBootstrap(response(firstScope), response(firstScope).page.entities);
    const first = await store.queue(firstScope, 'INVENTORY_MOVEMENT', { quantity: '2' });
    const second = await store.queue(firstScope, 'CASH_SALE', { total: '10.00' });

    expect([first.sequence, second.sequence]).toEqual([1, 2]);
    expect(first.idempotencyKey).toContain(first.commandId);
    expect(first).toMatchObject({
      valuationMethod: 'MOVING_AVERAGE',
      valuationPolicyVersion: 1,
    });
    await store.markSent([first.commandId, second.commandId]);
    expect((await store.pending(firstScope)).map(({ status }) => status)).toEqual(['SENT', 'SENT']);

    await store.settle([
      {
        commandId: first.commandId,
        sequence: 1,
        status: 'CONFIRMED',
        replay: false,
        result: { id: 'movement-1' },
      },
      {
        commandId: second.commandId,
        sequence: 2,
        status: 'ERROR',
        replay: false,
        error: { status: 422 },
      },
    ]);

    expect(await store.pending(firstScope)).toEqual([]);
    expect((await store.outbox(firstScope)).map(({ status }) => status)).toEqual([
      'CONFIRMED',
      'ERROR',
    ]);
  });

  it('backs off transport failures without sending later causal commands early', async () => {
    const store = new OfflineStoreService();
    await store.replaceBootstrap(response(firstScope), response(firstScope).page.entities);
    const first = await store.queue(firstScope, 'INVENTORY_MOVEMENT', { quantity: '2' });
    await store.markSent([first.commandId]);
    await store.retry([first.commandId], new Error('network down'));
    await store.queue(firstScope, 'INVENTORY_MOVEMENT', { quantity: '3' });

    expect(await store.pending(firstScope)).toEqual([]);
    expect(await store.outbox(firstScope)).toEqual([
      expect.objectContaining({
        sequence: 1,
        status: 'ERROR',
        attempts: 1,
        retryable: true,
        lastError: { name: 'Error', message: 'network down' },
      }),
      expect.objectContaining({ sequence: 2, status: 'PENDING' }),
    ]);
  });

  it('retries transport failures and safely rejects commands never sent', async () => {
    const store = new OfflineStoreService();
    await store.replaceBootstrap(response(firstScope), response(firstScope).page.entities);
    const failed = await store.queue(firstScope, 'INVENTORY_MOVEMENT', { quantity: '2' });
    await store.markSent([failed.commandId]);
    await store.retry([failed.commandId], new Error('network down'));
    await store.retryNow(firstScope, failed.commandId);
    expect(await store.pending(firstScope)).toEqual([
      expect.objectContaining({ commandId: failed.commandId, status: 'PENDING' }),
    ]);

    await store.settle([
      { commandId: failed.commandId, sequence: 1, status: 'CONFIRMED', replay: false },
    ]);
    const rejected = await store.queue(firstScope, 'INVENTORY_COUNT', { quantity: '3' });
    const following = await store.queue(firstScope, 'INVENTORY_MOVEMENT', { quantity: '1' });
    await store.rejectPending(firstScope, rejected.commandId);

    const commands = await store.outbox(firstScope);
    expect(commands.map(({ commandId, sequence }) => ({ commandId, sequence }))).toEqual([
      { commandId: failed.commandId, sequence: 1 },
      { commandId: following.commandId, sequence: 2 },
    ]);
  });

  it('advances the cursor atomically with upserts and tombstones', async () => {
    const store = new OfflineStoreService();
    const bootstrap = response(firstScope);
    await store.replaceBootstrap(bootstrap, bootstrap.page.entities);
    await store.applyChanges(
      firstScope,
      [
        {
          changeId: 'change-1',
          operation: 'DELETE',
          occurredAt: '2026-08-27T20:01:00.000Z',
          entity: bootstrap.page.entities[0],
        },
        {
          changeId: 'change-2',
          operation: 'UPSERT',
          occurredAt: '2026-08-27T20:02:00.000Z',
          entity: {
            kind: 'PRODUCT',
            id: 'product-2',
            tenantId: firstScope.tenantId,
            version: 1,
            updatedAt: '2026-08-27T20:02:00.000Z',
          },
        },
      ],
      'cursor-after-apply',
    );

    expect(await store.summary(firstScope)).toEqual(
      expect.objectContaining({ entities: 2, cursor: 'cursor-after-apply' }),
    );
  });

  it('recovers an incomplete local schema by rebuilding it', async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('uinventario-offline', OFFLINE_SCHEMA_VERSION);
      request.onupgradeneeded = () => request.result.createObjectStore('legacy');
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });

    const store = new OfflineStoreService();
    expect(await store.deviceId()).toMatch(/^[0-9a-f-]{36}$/i);
    await store.replaceBootstrap(response(firstScope), response(firstScope).page.entities);
    expect(await store.summary(firstScope)).toEqual(expect.objectContaining({ entities: 2 }));
  });

  it('drops incompatible version-one outbox entries during the causal-sequence upgrade', async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('uinventario-offline', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('meta', { keyPath: 'key' });
        request.result.createObjectStore('scopes', { keyPath: 'key' });
        const entities = request.result.createObjectStore('entities', { keyPath: 'storageKey' });
        entities.createIndex('scopeKey', 'scopeKey');
        const outbox = request.result.createObjectStore('outbox', { keyPath: 'commandId' });
        outbox.createIndex('scopeKey', 'scopeKey');
        outbox.put({
          commandId: 'legacy-command',
          scopeKey: [
            firstScope.tenantId,
            firstScope.userId,
            firstScope.deviceId,
            firstScope.branchId,
            '-',
          ].join(':'),
        });
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });

    const store = new OfflineStoreService();
    expect(await store.outbox(firstScope)).toEqual([]);
    await store.replaceBootstrap(response(firstScope), response(firstScope).page.entities);
    expect((await store.queue(firstScope, 'INVENTORY_MOVEMENT', {})).sequence).toBe(1);
  });

  it('blocks stale sensitive actions, detects an invalid clock and recovers after online sync', async () => {
    const store = new OfflineStoreService();
    const bootstrap = response(firstScope);
    await store.replaceBootstrap(bootstrap, bootstrap.page.entities);
    const storedAt = new Date().getTime();

    const cashStale = await store.freshness(firstScope, storedAt + 901_000);
    expect(cashStale.allowedActions).toMatchObject({
      CASH_SALE: false,
      INVENTORY_COUNT: true,
      INVENTORY_MOVEMENT: true,
    });
    await expect(store.assertAction(firstScope, 'CASH_SALE', storedAt + 901_000)).rejects.toThrow(
      'Conéctate',
    );
    await expect(store.freshness(firstScope, storedAt - 301_000)).resolves.toMatchObject({
      condition: 'CLOCK_INVALID',
    });

    const refreshedAt = new Date().toISOString();
    await store.applyChanges(firstScope, [], 'refreshed-cursor', {
      generatedAt: refreshedAt,
      sessionExpiresAt: new Date(Date.now() + 8 * 60 * 60_000).toISOString(),
      freshnessPolicy: policy(),
      roles: ['ADMIN'],
      permissions: ['INVENTORY_VIEW'],
    });
    await expect(store.freshness(firstScope)).resolves.toMatchObject({
      condition: 'FRESH',
      allowedActions: { CASH_SALE: true },
    });
  });

  it('notifies another tab when the shared outbox changes', async () => {
    const firstTab = new OfflineStoreService();
    const secondTab = new OfflineStoreService();
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    firstTab.watchOutbox(firstScope, firstListener);
    secondTab.watchOutbox(firstScope, secondListener);

    await firstTab.replaceBootstrap(response(firstScope), response(firstScope).page.entities);
    await firstTab.queue(firstScope, 'INVENTORY_COUNT', { countedQuantity: '2' });

    expect(firstListener).toHaveBeenCalledOnce();
    expect(secondListener).toHaveBeenCalledOnce();
    expect(await secondTab.outbox(firstScope)).toHaveLength(1);
  });

  function response(scope: typeof firstScope): OfflineBootstrapData {
    const generatedAt = new Date().toISOString();
    return {
      protocolVersion: '1.0',
      generatedAt,
      sessionExpiresAt: new Date(Date.now() + 8 * 60 * 60_000).toISOString(),
      freshnessPolicy: policy(),
      valuationPolicy: {
        method: 'MOVING_AVERAGE',
        version: 1,
        effectiveAt: generatedAt,
        migrationRule: 'INITIAL_DEFAULT',
      },
      scope,
      identity: {
        tenant: { id: scope.tenantId, name: 'Tenant' },
        user: { id: scope.userId, roles: ['ADMIN'], permissions: ['INVENTORY_VIEW'] },
      },
      page: {
        initialSyncCursor: 'signed-session-cursor',
        cursor: 'page-0',
        nextCursor: null,
        complete: true,
        entities: [
          {
            kind: 'BRANCH',
            id: 'branch-1',
            tenantId: scope.tenantId,
            version: 1,
            updatedAt: '2026-08-27T19:00:00.000Z',
          },
          {
            kind: 'PRODUCT',
            id: 'product-1',
            tenantId: scope.tenantId,
            version: 2,
            updatedAt: '2026-08-27T19:30:00.000Z',
          },
        ],
      },
    };
  }

  function policy() {
    return {
      version: 1 as const,
      maxClockSkewSeconds: 300,
      catalogTtlSeconds: 86400,
      permissionsTtlSeconds: 3600,
      actionTtlSeconds: {
        CASH_SALE: 900,
        INVENTORY_COUNT: 14400,
        INVENTORY_MOVEMENT: 3600,
      },
    };
  }
});
