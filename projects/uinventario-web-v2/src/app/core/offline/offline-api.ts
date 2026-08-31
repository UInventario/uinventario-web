import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../api/api-client';
import { ApiEnvelope } from '../api/api-contracts';
import {
  OFFLINE_PROTOCOL_VERSION,
  OfflineBootstrap,
  OfflineChanges,
  OfflineCommand,
} from './offline.models';

export interface OfflineCommandResult {
  readonly commandId: string;
  readonly sequence: number;
  readonly status: 'CONFIRMED' | 'ERROR';
  readonly replay: boolean;
  readonly result?: unknown;
  readonly error?: unknown;
}

@Injectable({ providedIn: 'root' })
export class OfflineApi {
  private readonly api = inject(ApiClient);

  bootstrap(deviceId: string, cursor?: string) {
    return this.api
      .get<{ readonly data: OfflineBootstrap }>('/offline/bootstrap', {
        params: {
          protocolVersion: OFFLINE_PROTOCOL_VERSION,
          deviceId,
          pageSize: 500,
          ...(cursor ? { cursor } : {}),
        },
      })
      .pipe(map(({ data }) => data));
  }

  changes(deviceId: string, cursor: string) {
    return this.api
      .get<{ readonly data: OfflineChanges }>('/offline/changes', {
        params: { protocolVersion: OFFLINE_PROTOCOL_VERSION, deviceId, cursor, pageSize: 500 },
      })
      .pipe(map(({ data }) => data));
  }

  commands(commands: readonly OfflineCommand[]) {
    const body = {
      commands: commands.map(toEnvelope),
    };
    return this.api
      .post<ApiEnvelope<{ readonly results: readonly OfflineCommandResult[] }>, typeof body>(
        '/offline/commands/batch',
        body,
      )
      .pipe(map(({ data }) => data.results));
  }
}

function toEnvelope(command: OfflineCommand) {
  return {
    protocolVersion: command.protocolVersion,
    commandId: command.commandId,
    idempotencyKey: command.idempotencyKey,
    scope: command.scope,
    sequence: command.sequence,
    createdAt: command.createdAt,
    valuationMethod: command.valuationMethod,
    valuationPolicyVersion: command.valuationPolicyVersion,
    kind: command.kind,
    payload: command.payload,
  };
}
