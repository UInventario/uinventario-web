import { TestBed } from '@angular/core/testing';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { OfflineCommandApiService } from './offline-command-api.service';
import { OfflineOutboxService } from './offline-outbox.service';
import { OfflineStoreService } from './offline-store.service';
import { SessionApiService } from '../auth/session-api.service';

describe('OfflineOutboxService', () => {
  const scope = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    deviceId: '10000000-0000-4000-8000-000000000001',
    branchId: 'branch-1',
    cashRegisterId: null,
  };
  const api = { send: vi.fn() };
  const sessions = { invalidate: vi.fn() };
  let store: OfflineStoreService;
  let service: OfflineOutboxService;

  beforeEach(() => {
    Object.assign(globalThis, { indexedDB: new IDBFactory(), IDBKeyRange });
    api.send.mockReset();
    sessions.invalidate.mockReset();
    TestBed.configureTestingModule({
      providers: [
        OfflineStoreService,
        OfflineOutboxService,
        { provide: OfflineCommandApiService, useValue: api },
        { provide: SessionApiService, useValue: sessions },
      ],
    });
    store = TestBed.inject(OfflineStoreService);
    service = TestBed.inject(OfflineOutboxService);
  });

  it('keeps a command retryable when connectivity fails before receiving a response', async () => {
    const command = await store.queue(scope, 'INVENTORY_MOVEMENT', { quantity: '2' });
    api.send.mockReturnValue(throwError(() => new Error('offline')));

    await expect(service.flush(scope)).rejects.toThrow('offline');

    expect(await store.outbox(scope)).toEqual([
      expect.objectContaining({
        commandId: command.commandId,
        status: 'ERROR',
        attempts: 1,
        retryable: true,
      }),
    ]);
  });

  it('confirms a sent command from the stable replay after a response was lost', async () => {
    const command = await store.queue(scope, 'INVENTORY_MOVEMENT', { quantity: '2' });
    await store.markSent([command.commandId]);
    api.send.mockReturnValue(
      of({
        data: {
          results: [
            {
              commandId: command.commandId,
              sequence: command.sequence,
              status: 'CONFIRMED',
              replay: true,
              result: { data: { id: 'movement-1' } },
            },
          ],
        },
      }),
    );

    await expect(service.flush(scope)).resolves.toEqual({ confirmed: 1, rejected: 0 });
    expect(await store.outbox(scope)).toEqual([
      expect.objectContaining({
        commandId: command.commandId,
        status: 'CONFIRMED',
        attempts: 2,
        result: { data: { id: 'movement-1' } },
      }),
    ]);
  });

  it('settles returned results and backs off a missing partial-batch result', async () => {
    const first = await store.queue(scope, 'INVENTORY_MOVEMENT', { quantity: '2' });
    const second = await store.queue(scope, 'INVENTORY_MOVEMENT', { quantity: '3' });
    api.send.mockReturnValue(
      of({
        data: {
          results: [
            {
              commandId: first.commandId,
              sequence: first.sequence,
              status: 'CONFIRMED',
              replay: false,
            },
          ],
        },
      }),
    );

    await expect(service.flush(scope)).resolves.toEqual({ confirmed: 1, rejected: 0 });
    expect(await store.outbox(scope)).toEqual([
      expect.objectContaining({ commandId: first.commandId, status: 'CONFIRMED' }),
      expect.objectContaining({
        commandId: second.commandId,
        status: 'ERROR',
        retryable: true,
      }),
    ]);
  });

  it('invalidates local access when the server revokes the device', async () => {
    await store.queue(scope, 'INVENTORY_MOVEMENT', { quantity: '2' });
    api.send.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 403,
            error: { code: 'OFFLINE_DEVICE_REVOKED' },
          }),
      ),
    );

    await expect(service.flush(scope)).rejects.toMatchObject({ status: 403 });
    expect(sessions.invalidate).toHaveBeenCalledOnce();
  });
});
