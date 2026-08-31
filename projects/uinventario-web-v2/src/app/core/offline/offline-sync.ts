import { computed, Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../api/api-error';
import { SessionState } from '../session/session-state';
import { OfflineApi } from './offline-api';
import {
  OfflineBootstrap,
  OfflineChanges,
  OfflineCommand,
  OfflineCommandKind,
  OfflineScope,
  OfflineSummary,
  scopeFor,
} from './offline.models';
import { OfflineStore } from './offline-store';

export type OfflineOperationalState = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'STALE' | 'CONFLICT';

@Injectable({ providedIn: 'root' })
export class OfflineSync {
  private readonly api = inject(OfflineApi);
  private readonly store = inject(OfflineStore);
  private readonly sessions = inject(SessionState);
  private active?: Promise<void>;
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly busy = signal(false);
  readonly summary = signal<OfflineSummary>(emptySummary());
  readonly commands = signal<readonly OfflineCommand[]>([]);
  readonly error = signal<string | null>(null);
  readonly state = computed<OfflineOperationalState>(() => {
    if (this.busy()) return 'SYNCING';
    if (!this.online()) return 'OFFLINE';
    if (this.summary().conflicts) return 'CONFLICT';
    if (this.summary().catalogStale || this.summary().permissionsStale) return 'STALE';
    return 'ONLINE';
  });

  constructor() {
    globalThis.addEventListener?.('online', () => {
      this.online.set(true);
      void this.synchronize();
    });
    globalThis.addEventListener?.('offline', () => this.online.set(false));
  }

  async restore(): Promise<void> {
    const scope = await this.currentScope();
    await this.refresh(scope);
  }

  markOffline(): void {
    this.online.set(false);
  }

  reconnect(): Promise<void> {
    this.online.set(true);
    return this.synchronize(true);
  }

  prepare(): Promise<void> {
    return this.run(() => this.prepareDirect());
  }

  synchronize(force = false): Promise<void> {
    if (!this.online()) return Promise.reject(new Error('No hay conexión para sincronizar.'));
    return this.run(async () => {
      const scope = await this.currentScope();
      let current = await this.store.record(scope);
      if (!current) {
        await this.prepareDirect();
        current = await this.store.record(scope);
      }
      if (!current) throw new Error('No fue posible preparar los datos offline.');
      await this.flush(scope, force);
      let cursor = current.cursor;
      let more: boolean;
      do {
        const changes = await firstValueFrom(this.api.changes(scope.deviceId, cursor));
        if (JSON.stringify(changes.scope) !== JSON.stringify(scope)) {
          throw new Error('El contexto autorizado cambió durante la sincronización.');
        }
        await this.store.applyChanges(scope, changes);
        this.acceptIdentity(changes);
        cursor = changes.nextCursor;
        more = changes.hasMore;
      } while (more);
      await this.refresh(scope);
    }, true);
  }

  async queue(
    kind: OfflineCommandKind,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<OfflineCommand> {
    const scope = await this.currentScope();
    await this.refresh(scope);
    const summary = this.summary();
    if (!summary.prepared || summary.sessionExpired || summary.permissionsStale) {
      throw new Error('Los datos offline no están vigentes para guardar esta operación.');
    }
    const command = await this.store.queue(scope, kind, payload);
    await this.refresh(scope);
    return command;
  }

  async retry(commandId: string): Promise<void> {
    const scope = await this.currentScope();
    await this.store.requeue(scope, commandId);
    await this.synchronize(true);
  }

  async discard(commandId: string): Promise<void> {
    const scope = await this.currentScope();
    await this.store.discard(scope, commandId);
    await this.refresh(scope);
  }

  private run(action: () => Promise<void>, rebuildOnCursorFailure = false): Promise<void> {
    this.active ??= (async () => {
      this.busy.set(true);
      this.error.set(null);
      try {
        await action();
      } catch (error) {
        if (
          rebuildOnCursorFailure &&
          error instanceof ApiError &&
          ['OFFLINE_SYNC_CURSOR_EXPIRED', 'OFFLINE_SYNC_SCOPE_CHANGED'].includes(error.code)
        ) {
          await this.prepareDirect();
          return;
        }
        if (error instanceof ApiError && ['network', 'timeout'].includes(error.kind)) {
          this.online.set(false);
        }
        this.error.set(message(error));
        throw error;
      } finally {
        this.busy.set(false);
        this.active = undefined;
      }
    })();
    return this.active;
  }

  private async prepareDirect(): Promise<void> {
    const session = this.sessions.session();
    if (!session) throw new Error('La sesión no está disponible.');
    const expectedScope = scopeFor(session, await this.store.deviceId());
    let cursor: string | undefined;
    let last: OfflineBootstrap;
    const entities: OfflineBootstrap['page']['entities'][number][] = [];
    do {
      const page = await firstValueFrom(this.api.bootstrap(expectedScope.deviceId, cursor));
      if (!sameScope(page.scope, expectedScope)) {
        throw new Error('El contexto autorizado cambió durante la descarga offline.');
      }
      entities.push(...page.page.entities);
      cursor = page.page.nextCursor ?? undefined;
      last = page;
    } while (cursor);
    if (!last.page.complete) throw new Error('El bootstrap no terminó correctamente.');
    await this.store.replaceBootstrap(last, entities, session);
    await this.refresh(expectedScope);
  }

  private async flush(scope: OfflineScope, force: boolean): Promise<void> {
    while (true) {
      const batch = await this.store.sendable(scope, force);
      if (!batch.length) return;
      const ids = batch.map(({ commandId }) => commandId);
      await this.store.markSending(scope, ids);
      try {
        const results = await firstValueFrom(this.api.commands(batch));
        await this.store.settle(scope, results);
        const received = new Set(results.map(({ commandId }) => commandId));
        const missing = ids.filter((id) => !received.has(id));
        if (missing.length) {
          await this.store.transportFailure(
            scope,
            missing,
            new Error('El servidor no confirmó el lote completo.'),
          );
          return;
        }
      } catch (error) {
        if (isCommandConflict(error)) {
          await this.store.settle(
            scope,
            ids.map((commandId) => ({
              commandId,
              status: 'ERROR' as const,
              error: { code: error.code, message: error.message },
            })),
          );
          return;
        }
        await this.store.transportFailure(scope, ids, error);
        throw error;
      }
    }
  }

  private async currentScope(): Promise<OfflineScope> {
    const session = this.sessions.session();
    if (!session) throw new Error('La sesión no está disponible.');
    return scopeFor(session, await this.store.deviceId());
  }

  private async refresh(scope: OfflineScope): Promise<void> {
    const record = await this.store.record(scope);
    this.summary.set(await this.store.summary(scope));
    this.commands.set(record?.commands ?? []);
  }

  private acceptIdentity(changes: OfflineChanges): void {
    const session = this.sessions.session();
    if (!session || changes.identity.user.id !== session.user.id) {
      throw new Error('La identidad autorizada cambió durante la sincronización.');
    }
    this.sessions.accept({
      data: {
        ...session,
        user: {
          ...session.user,
          roles: changes.identity.user.roles,
          permissions: changes.identity.user.permissions,
        },
      },
      meta: { apiVersion: '1', sessionExpiresAt: changes.sessionExpiresAt },
    });
  }
}

function sameScope(left: OfflineScope, right: OfflineScope): boolean {
  return (
    left.tenantId === right.tenantId &&
    left.userId === right.userId &&
    left.deviceId === right.deviceId &&
    left.branchId === right.branchId &&
    left.cashRegisterId === right.cashRegisterId
  );
}

function isCommandConflict(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    ['OFFLINE_COMMAND_CONFLICT', 'OFFLINE_COMMAND_SEQUENCE_GAP'].includes(error.code)
  );
}

function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : 'No fue posible sincronizar los datos offline.';
}

function emptySummary(): OfflineSummary {
  return {
    prepared: false,
    entities: 0,
    pending: 0,
    conflicts: 0,
    generatedAt: null,
    catalogStale: true,
    permissionsStale: true,
    sessionExpired: true,
  };
}
