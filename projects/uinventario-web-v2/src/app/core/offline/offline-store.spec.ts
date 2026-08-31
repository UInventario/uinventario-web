import 'fake-indexeddb/auto';
import { OfflineBootstrap, OfflineEntity, OfflineScope } from './offline.models';
import { OfflineStore } from './offline-store';
import { SessionData } from '../session/session.models';

describe('OfflineStore', () => {
  let store: OfflineStore;

  beforeEach(async () => {
    store = new OfflineStore();
    await store.clearAll();
  });

  afterEach(async () => store.clearAll());

  it('isolates cached entities by tenant, user, device and operating context', async () => {
    const first = scope('tenant-a', 'user-a', 'device-a');
    const second = scope('tenant-b', 'user-b', 'device-b');
    await store.replaceBootstrap(bootstrap(first), [product(first, 'product-a')], session(first));
    await store.replaceBootstrap(
      bootstrap(second),
      [product(second, 'product-b')],
      session(second),
    );

    await expect(store.entities(first, 'PRODUCT')).resolves.toMatchObject([{ id: 'product-a' }]);
    await expect(store.entities(second, 'PRODUCT')).resolves.toMatchObject([{ id: 'product-b' }]);
  });

  it('keeps stable command and idempotency identities across transport retry', async () => {
    const current = scope('tenant-a', 'user-a', 'device-a');
    await store.replaceBootstrap(bootstrap(current), [], session(current));
    const queued = await store.queue(current, 'INVENTORY_MOVEMENT', {
      productId: 'product-a',
      quantity: '1.000',
    });

    await store.markSending(current, [queued.commandId]);
    await store.transportFailure(current, [queued.commandId], new Error('network'));
    let retained = (await store.record(current))?.commands[0];
    expect(retained).toMatchObject({
      commandId: queued.commandId,
      idempotencyKey: queued.idempotencyKey,
      sequence: 1,
      status: 'PENDING',
      attempts: 1,
      retryable: true,
    });
    expect(await store.sendable(current)).toHaveLength(0);

    await store.retry(current, queued.commandId);
    retained = (await store.sendable(current))[0];
    expect(retained?.commandId).toBe(queued.commandId);
    expect(retained?.idempotencyKey).toBe(queued.idempotencyKey);

    await store.settle(current, [{ commandId: queued.commandId, status: 'CONFIRMED' }]);
    const next = await store.queue(current, 'INVENTORY_MOVEMENT', { quantity: '2.000' });
    expect(next.sequence).toBe(2);

    const otherContext = { ...current, branchId: 'branch-b', cashRegisterId: 'register-b' };
    await store.replaceBootstrap(bootstrap(otherContext), [], session(otherContext));
    const afterContextChange = await store.queue(otherContext, 'CASH_SALE', { lines: [] });
    expect(afterContextChange.sequence).toBe(3);
  });

  it('keeps conflicts visible until the user retries or discards them', async () => {
    const current = scope('tenant-a', 'user-a', 'device-a');
    await store.replaceBootstrap(bootstrap(current), [], session(current));
    const conflict = await store.queue(current, 'CASH_SALE', { lines: [] });
    const confirmed = await store.queue(current, 'INVENTORY_MOVEMENT', { quantity: '1.000' });

    await store.settle(current, [
      { commandId: conflict.commandId, status: 'ERROR', error: { code: 'STOCK_CHANGED' } },
      { commandId: confirmed.commandId, status: 'CONFIRMED' },
    ]);

    expect(await store.summary(current)).toMatchObject({ pending: 0, conflicts: 1 });
    expect((await store.record(current))?.commands).toMatchObject([
      { commandId: conflict.commandId, status: 'ERROR', retryable: false },
    ]);
    await store.discard(current, conflict.commandId);
    expect(await store.summary(current)).toMatchObject({ pending: 0, conflicts: 0 });
  });

  it('requeues a resolved conflict with a new causal and idempotent identity', async () => {
    const current = scope('tenant-a', 'user-a', 'device-a');
    await store.replaceBootstrap(bootstrap(current), [], session(current));
    const rejected = await store.queue(current, 'CASH_SALE', { lines: [] });
    await store.settle(current, [
      { commandId: rejected.commandId, status: 'ERROR', error: { code: 'STOCK_CHANGED' } },
    ]);

    const retried = await store.requeue(current, rejected.commandId);

    expect(retried).toMatchObject({ sequence: 2, status: 'PENDING', payload: { lines: [] } });
    expect(retried.commandId).not.toBe(rejected.commandId);
    expect(retried.idempotencyKey).not.toBe(rejected.idempotencyKey);
    expect((await store.record(current))?.commands).toMatchObject([
      { commandId: retried.commandId, sequence: 2 },
    ]);
  });

  it('erases every cached scope and device identity for the logout policy', async () => {
    const current = scope('tenant-a', 'user-a', 'device-a');
    await store.replaceBootstrap(
      bootstrap(current),
      [product(current, 'product-a')],
      session(current),
    );
    const oldDevice = await store.deviceId();
    await expect(store.restoreSession()).resolves.toMatchObject({
      session: { user: { id: current.userId }, tenant: { id: current.tenantId } },
    });

    await store.clearAll();

    await expect(store.record(current)).resolves.toBeNull();
    await expect(store.restoreSession()).resolves.toBeNull();
    await expect(store.deviceId()).resolves.not.toBe(oldDevice);
  });
});

function scope(tenantId: string, userId: string, deviceId: string): OfflineScope {
  return { tenantId, userId, deviceId, branchId: 'branch-a', cashRegisterId: 'register-a' };
}

function session(current: OfflineScope): SessionData {
  return {
    user: {
      id: current.userId,
      email: 'admin@example.com',
      roles: ['ADMIN'],
      permissions: ['INVENTORY_VIEW'],
    },
    tenant: { id: current.tenantId, name: 'Empresa' },
    context: {
      branch: current.branchId ? { id: current.branchId, name: 'Sucursal' } : null,
      warehouse: { id: 'warehouse-a', name: 'Bodega' },
      cashRegister: current.cashRegisterId
        ? { id: current.cashRegisterId, name: 'Caja', code: 'CAJA-1' }
        : null,
    },
    nextStep: 'APPLICATION',
  };
}

function bootstrap(current: OfflineScope): OfflineBootstrap {
  return {
    protocolVersion: '1.0',
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
      tenant: { id: current.tenantId, name: 'Empresa' },
      user: { id: current.userId, roles: ['ADMIN'], permissions: [] },
    },
    valuationPolicy: { method: 'MOVING_AVERAGE', version: 1 },
    posPolicy: null,
    page: { initialSyncCursor: 'cursor-1', nextCursor: null, complete: true, entities: [] },
  };
}

function product(current: OfflineScope, id: string): OfflineEntity {
  return {
    kind: 'PRODUCT',
    id,
    tenantId: current.tenantId,
    version: 1,
    updatedAt: new Date().toISOString(),
    name: id,
  };
}
