import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';
import { OfflineCommandServerResult, OfflineOutboxCommand } from './offline-store.service';

export type OfflineCommandEnvelope = Pick<
  OfflineOutboxCommand,
  | 'protocolVersion'
  | 'commandId'
  | 'scope'
  | 'idempotencyKey'
  | 'sequence'
  | 'kind'
  | 'payload'
  | 'createdAt'
  | 'valuationMethod'
  | 'valuationPolicyVersion'
>;

interface OfflineCommandBatchResponse {
  data: { results: OfflineCommandServerResult[] };
}

@Injectable({ providedIn: 'root' })
export class OfflineCommandApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  send(commands: OfflineCommandEnvelope[]) {
    return this.http.post<OfflineCommandBatchResponse>(
      `${this.config.apiBaseUrl()}/offline/commands/batch`,
      { commands },
      { withCredentials: true },
    );
  }
}
