import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OfflineCommandApiService, OfflineCommandEnvelope } from './offline-command-api.service';
import {
  OfflineCommandServerResult,
  OfflineOutboxCommand,
  OfflineScopeIdentity,
  OfflineStoreService,
} from './offline-store.service';
import { SessionApiService } from '../auth/session-api.service';

export interface OfflineFlushSummary {
  confirmed: number;
  rejected: number;
}

@Injectable({ providedIn: 'root' })
export class OfflineOutboxService {
  private readonly api = inject(OfflineCommandApiService);
  private readonly store = inject(OfflineStoreService);
  private readonly sessions = inject(SessionApiService);
  private active: Promise<OfflineFlushSummary> | undefined;

  flush(scope: OfflineScopeIdentity): Promise<OfflineFlushSummary> {
    this.active ??= this.flushPending(scope).finally(() => {
      this.active = undefined;
    });
    return this.active;
  }

  private async flushPending(scope: OfflineScopeIdentity): Promise<OfflineFlushSummary> {
    const summary: OfflineFlushSummary = { confirmed: 0, rejected: 0 };
    while (true) {
      const batch = (await this.store.pending(scope)).slice(0, 20);
      if (!batch.length) return summary;
      const commandIds = batch.map(({ commandId }) => commandId);
      await this.store.markSent(commandIds);
      try {
        const response = await firstValueFrom(
          this.api.send(batch.map((item) => this.envelope(item))),
        );
        const expected = new Set(commandIds);
        const results = response.data.results.filter(({ commandId }) => expected.has(commandId));
        await this.store.settle(results);
        const received = new Set(results.map(({ commandId }) => commandId));
        const missing = commandIds.filter((commandId) => !received.has(commandId));
        if (missing.length) {
          await this.store.retry(missing, 'El servidor no confirmó todos los comandos del lote.');
        }
        this.addResults(summary, results);
        if (missing.length) return summary;
      } catch (error) {
        if (
          error instanceof HttpErrorResponse &&
          (error.status === 401 ||
            (error.status === 403 && error.error?.code === 'OFFLINE_DEVICE_REVOKED'))
        ) {
          this.sessions.invalidate();
          throw error;
        }
        await this.store.retry(commandIds, error);
        throw error;
      }
    }
  }

  private envelope(command: OfflineOutboxCommand): OfflineCommandEnvelope {
    return {
      protocolVersion: command.protocolVersion,
      commandId: command.commandId,
      scope: command.scope,
      idempotencyKey: command.idempotencyKey,
      sequence: command.sequence,
      kind: command.kind,
      payload: command.payload,
      createdAt: command.createdAt,
    };
  }

  private addResults(summary: OfflineFlushSummary, results: OfflineCommandServerResult[]): void {
    for (const result of results) {
      if (result.status === 'CONFIRMED') summary.confirmed += 1;
      else summary.rejected += 1;
    }
  }
}
