import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { OfflineBootstrapData } from './offline-bootstrap-api.service';
import { OFFLINE_SCHEMA_VERSION, OfflineStoreService } from './offline-store.service';

describe('OfflineStoreService', () => {
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
    });
  });

  it('persists a versioned bootstrap across service instances and clears it on logout', async () => {
    expect(OFFLINE_SCHEMA_VERSION).toBe(1);
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
    await store.enqueue({
      commandId: 'command-1',
      scopeKey: store.scopeKey(firstScope),
      idempotencyKey: 'idem-1',
      type: 'SALE_CREATE',
      payload: { total: '10.00' },
      createdAt: '2026-08-27T20:00:00.000Z',
      attempts: 0,
    });
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
      store.enqueue({
        commandId: 'unsafe-command',
        scopeKey: store.scopeKey(firstScope),
        idempotencyKey: 'idem-unsafe',
        type: 'UNSAFE',
        payload: { authorizationToken: 'must-not-be-stored' },
        createdAt: '2026-08-27T20:00:00.000Z',
        attempts: 0,
      }),
    ).rejects.toMatchObject({ code: 'WRITE_FAILED' });
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

  function response(scope: typeof firstScope): OfflineBootstrapData {
    return {
      protocolVersion: '1.0',
      generatedAt: '2026-08-27T20:00:00.000Z',
      scope,
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
});
