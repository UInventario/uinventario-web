import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { ApiClient } from '../api/api-client';
import { OfflineApi } from './offline-api';
import { OfflineCommand } from './offline.models';

describe('OfflineApi', () => {
  const api = { get: vi.fn(), post: vi.fn() };
  let offline: OfflineApi;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [OfflineApi, { provide: ApiClient, useValue: api }],
    });
    offline = TestBed.inject(OfflineApi);
  });

  it('requests the versioned bootstrap with the maximum supported page size', () => {
    api.get.mockReturnValue(of({ data: { page: {} } }));
    offline.bootstrap('device-1', 'cursor-1').subscribe();
    expect(api.get).toHaveBeenCalledWith('/offline/bootstrap', {
      params: {
        protocolVersion: '1.0',
        deviceId: 'device-1',
        pageSize: 500,
        cursor: 'cursor-1',
      },
    });
  });

  it('sends only the durable command envelope and preserves causal identities', async () => {
    api.post.mockReturnValue(of({ data: { results: [] }, meta: { apiVersion: '1' } }));
    const command = queuedCommand();

    await firstValueFrom(offline.commands([command]));

    const body = api.post.mock.calls[0]?.[1] as { commands: Record<string, unknown>[] };
    expect(body.commands[0]).toMatchObject({
      commandId: command.commandId,
      idempotencyKey: command.idempotencyKey,
      sequence: command.sequence,
      kind: command.kind,
    });
    expect(body.commands[0]).not.toHaveProperty('status');
    expect(body.commands[0]).not.toHaveProperty('attempts');
    expect(body.commands[0]).not.toHaveProperty('nextRetryAt');
    expect(body.commands[0]).not.toHaveProperty('retryable');
    expect(body.commands[0]).not.toHaveProperty('error');
  });
});

function queuedCommand(): OfflineCommand {
  return {
    protocolVersion: '1.0',
    commandId: 'command-1',
    idempotencyKey: 'offline-command-1',
    scope: {
      tenantId: 'tenant-1',
      userId: 'user-1',
      deviceId: 'device-1',
      branchId: 'branch-1',
      cashRegisterId: 'register-1',
    },
    sequence: 1,
    createdAt: new Date().toISOString(),
    valuationMethod: 'MOVING_AVERAGE',
    valuationPolicyVersion: 1,
    kind: 'CASH_SALE',
    payload: { lines: [] },
    status: 'PENDING',
    attempts: 0,
    nextRetryAt: null,
    retryable: true,
    error: null,
  };
}
