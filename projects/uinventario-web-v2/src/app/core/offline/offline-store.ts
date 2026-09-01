import { Injectable } from '@angular/core';
import {
  OFFLINE_PROTOCOL_VERSION,
  OfflineBootstrap,
  OfflineChanges,
  OfflineCommand,
  OfflineCommandKind,
  OfflineEntity,
  OfflineRecord,
  OfflineScope,
  OfflineSessionSnapshot,
  OfflineSummary,
  offlineScopeKey,
} from './offline.models';
import { SessionData } from '../session/session.models';

const DATABASE_NAME = 'uinventario-v2-offline';
const DATABASE_VERSION = 1;
const FORBIDDEN = [
  'password',
  'passwordHash',
  'sessionToken',
  'refreshToken',
  'resetToken',
  'apiKey',
  'privateKey',
];

@Injectable({ providedIn: 'root' })
export class OfflineStore {
  private database?: Promise<IDBDatabase>;

  async deviceId(): Promise<string> {
    const current = await this.read<{ key: string; value: string }>('device', 'current');
    if (current?.value) return current.value;
    const value = crypto.randomUUID();
    await this.write('device', { key: 'current', value });
    return value;
  }

  async record(scope: OfflineScope): Promise<OfflineRecord | null> {
    return (await this.read<OfflineRecord>('scopes', offlineScopeKey(scope))) ?? null;
  }

  async entities<T extends OfflineEntity>(
    scope: OfflineScope,
    kind: string,
  ): Promise<readonly T[]> {
    const current = await this.required(scope);
    return current.entities.filter((entity): entity is T => entity.kind === kind);
  }

  async replaceBootstrap(
    last: OfflineBootstrap,
    entities: readonly OfflineEntity[],
    session: SessionData,
  ): Promise<void> {
    if (!sessionMatchesScope(session, last.scope)) {
      throw new Error('El bootstrap no pertenece a la sesión activa.');
    }
    const key = offlineScopeKey(last.scope);
    const existing = await this.record(last.scope);
    const withPolicy = last.posPolicy ? [...entities, last.posPolicy] : [...entities];
    await this.write('scopes', {
      key,
      scope: last.scope,
      session,
      generatedAt: last.generatedAt,
      sessionExpiresAt: last.sessionExpiresAt,
      cursor: last.page.initialSyncCursor,
      freshnessPolicy: last.freshnessPolicy,
      valuationPolicy: last.valuationPolicy,
      entities: deduplicate(withPolicy),
      commands: existing?.commands ?? [],
    } satisfies OfflineRecord);
    await this.write('device', { key: 'active-scope', value: key });
  }

  async applyChanges(scope: OfflineScope, changes: OfflineChanges): Promise<void> {
    const current = await this.required(scope);
    const entities = new Map(current.entities.map((entity) => [entityKey(entity), entity]));
    for (const change of changes.changes) {
      const key = entityKey(change.entity);
      if (change.operation === 'DELETE') entities.delete(key);
      else entities.set(key, change.entity);
    }
    await this.write('scopes', {
      ...current,
      session: {
        ...current.session,
        user: {
          ...current.session.user,
          roles: changes.identity.user.roles,
          permissions: changes.identity.user.permissions,
        },
      },
      generatedAt: changes.generatedAt,
      sessionExpiresAt: changes.sessionExpiresAt,
      cursor: changes.nextCursor,
      freshnessPolicy: changes.freshnessPolicy,
      entities: [...entities.values()],
    });
  }

  async queue(
    scope: OfflineScope,
    kind: OfflineCommandKind,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<OfflineCommand> {
    assertSafe(payload);
    const commandId = crypto.randomUUID();
    return this.appendWithNextSequence(scope, (current, sequence) => {
      const command: OfflineCommand = {
        protocolVersion: OFFLINE_PROTOCOL_VERSION,
        commandId,
        idempotencyKey: `offline-${commandId}`,
        scope,
        sequence,
        createdAt: new Date().toISOString(),
        valuationMethod: current.valuationPolicy.method,
        valuationPolicyVersion: current.valuationPolicy.version,
        kind,
        payload,
        status: 'PENDING',
        attempts: 0,
        nextRetryAt: null,
        retryable: true,
        error: null,
      };
      return { command, commands: [...current.commands, command] };
    });
  }

  async sendable(scope: OfflineScope, force = false): Promise<readonly OfflineCommand[]> {
    const commands = (await this.required(scope)).commands;
    const now = Date.now();
    return commands
      .filter(
        (command) =>
          command.status === 'PENDING' &&
          (force || !command.nextRetryAt || Date.parse(command.nextRetryAt) <= now),
      )
      .sort((left, right) => left.sequence - right.sequence)
      .slice(0, 20);
  }

  async markSending(scope: OfflineScope, commandIds: readonly string[]): Promise<void> {
    await this.updateCommands(scope, commandIds, (command) => ({ ...command, status: 'SENDING' }));
  }

  async settle(
    scope: OfflineScope,
    results: readonly {
      readonly commandId: string;
      readonly status: 'CONFIRMED' | 'ERROR';
      readonly error?: unknown;
    }[],
  ): Promise<void> {
    const current = await this.required(scope);
    const byId = new Map(results.map((result) => [result.commandId, result]));
    const commands = current.commands.flatMap((command) => {
      const result = byId.get(command.commandId);
      if (!result) return [command];
      if (result.status === 'CONFIRMED') return [];
      return [
        { ...command, status: 'ERROR' as const, retryable: false, error: result.error ?? null },
      ];
    });
    await this.saveCommands(current, commands);
  }

  async transportFailure(
    scope: OfflineScope,
    ids: readonly string[],
    error: unknown,
  ): Promise<void> {
    await this.updateCommands(scope, ids, (command) => {
      const attempts = command.attempts + 1;
      const delay = Math.min(60_000, 1_000 * 2 ** Math.min(attempts, 6));
      return {
        ...command,
        status: 'PENDING',
        attempts,
        nextRetryAt: new Date(Date.now() + delay).toISOString(),
        retryable: true,
        error: safeError(error),
      };
    });
  }

  async retry(scope: OfflineScope, commandId: string): Promise<void> {
    await this.updateCommands(scope, [commandId], (command) => ({
      ...command,
      status: 'PENDING',
      nextRetryAt: null,
      retryable: true,
    }));
  }

  async requeue(scope: OfflineScope, commandId: string): Promise<OfflineCommand> {
    const nextId = crypto.randomUUID();
    return this.appendWithNextSequence(scope, (current, sequence) => {
      const rejected = current.commands.find(({ commandId: id }) => id === commandId);
      if (!rejected || rejected.status !== 'ERROR') {
        throw new Error('El conflicto ya no está disponible para reintentar.');
      }
      const command: OfflineCommand = {
        ...rejected,
        commandId: nextId,
        idempotencyKey: `offline-${nextId}`,
        sequence,
        createdAt: new Date().toISOString(),
        valuationMethod: current.valuationPolicy.method,
        valuationPolicyVersion: current.valuationPolicy.version,
        status: 'PENDING',
        attempts: 0,
        nextRetryAt: null,
        retryable: true,
        error: null,
      };
      return {
        command,
        commands: [...current.commands.filter(({ commandId: id }) => id !== commandId), command],
      };
    });
  }

  async discard(scope: OfflineScope, commandId: string): Promise<void> {
    const current = await this.required(scope);
    await this.saveCommands(
      current,
      current.commands.filter(({ commandId: id }) => id !== commandId),
    );
  }

  async summary(scope: OfflineScope): Promise<OfflineSummary> {
    const current = await this.record(scope);
    if (!current) return emptySummary();
    const generated = Date.parse(current.generatedAt);
    const now = Date.now();
    return {
      prepared: true,
      entities: current.entities.length,
      pending: current.commands.filter(({ status }) => status !== 'ERROR').length,
      conflicts: current.commands.filter(({ status }) => status === 'ERROR').length,
      generatedAt: current.generatedAt,
      catalogStale: now - generated > current.freshnessPolicy.catalogTtlSeconds * 1_000,
      permissionsStale: now - generated > current.freshnessPolicy.permissionsTtlSeconds * 1_000,
      sessionExpired: now >= Date.parse(current.sessionExpiresAt),
    };
  }

  async clearAll(): Promise<void> {
    const database = await this.open();
    await transactionDone(
      database.transaction(['scopes', 'device'], 'readwrite'),
      (transaction) => {
        transaction.objectStore('scopes').clear();
        transaction.objectStore('device').clear();
      },
    );
  }

  async restoreSession(): Promise<OfflineSessionSnapshot | null> {
    const active = await this.read<{ readonly value?: unknown }>('device', 'active-scope');
    if (typeof active?.value !== 'string') return null;
    const current = await this.read<OfflineRecord>('scopes', active.value);
    if (!current) return null;
    const now = Date.now();
    if (
      now >= Date.parse(current.sessionExpiresAt) ||
      now - Date.parse(current.generatedAt) > current.freshnessPolicy.permissionsTtlSeconds * 1_000
    ) {
      return null;
    }
    return { session: current.session, sessionExpiresAt: current.sessionExpiresAt };
  }

  private async required(scope: OfflineScope): Promise<OfflineRecord> {
    const current = await this.record(scope);
    if (!current) throw new Error('Prepara los datos offline antes de guardar operaciones.');
    return current;
  }

  private async updateCommands(
    scope: OfflineScope,
    ids: readonly string[],
    update: (command: OfflineCommand) => OfflineCommand,
  ): Promise<void> {
    const current = await this.required(scope);
    const selected = new Set(ids);
    await this.saveCommands(
      current,
      current.commands.map((command) =>
        selected.has(command.commandId) ? update(command) : command,
      ),
    );
  }

  private async saveCommands(
    current: OfflineRecord,
    commands: readonly OfflineCommand[],
  ): Promise<void> {
    await this.write('scopes', { ...current, commands });
  }

  private async appendWithNextSequence(
    scope: OfflineScope,
    update: (
      current: OfflineRecord,
      sequence: number,
    ) => { readonly command: OfflineCommand; readonly commands: readonly OfflineCommand[] },
  ): Promise<OfflineCommand> {
    const database = await this.open();
    const transaction = database.transaction(['scopes', 'device'], 'readwrite');
    const scopes = transaction.objectStore('scopes');
    const devices = transaction.objectStore('device');
    const sequenceKey = `sequence:${scope.tenantId}:${scope.userId}:${scope.deviceId}`;
    return new Promise((resolve, reject) => {
      let command: OfflineCommand | undefined;
      const fail = () => reject(transaction.error ?? new Error('No fue posible guardar la cola.'));
      transaction.onerror = fail;
      transaction.onabort = fail;
      transaction.oncomplete = () =>
        command ? resolve(command) : reject(new Error('No fue posible guardar la cola.'));
      const scopeRequest = scopes.get(offlineScopeKey(scope));
      scopeRequest.onerror = () => transaction.abort();
      scopeRequest.onsuccess = () => {
        const current = scopeRequest.result as OfflineRecord | undefined;
        if (!current) {
          transaction.abort();
          return;
        }
        const sequenceRequest = devices.get(sequenceKey);
        sequenceRequest.onerror = () => transaction.abort();
        sequenceRequest.onsuccess = () => {
          try {
            const stored = sequenceRequest.result as { readonly value?: unknown } | undefined;
            const prior =
              typeof stored?.value === 'number'
                ? stored.value
                : Math.max(0, ...current.commands.map(({ sequence }) => sequence));
            const result = update(current, prior + 1);
            command = result.command;
            devices.put({ key: sequenceKey, value: prior + 1 });
            scopes.put({ ...current, commands: result.commands });
          } catch {
            transaction.abort();
          }
        };
      };
    });
  }

  private async read<T>(store: 'scopes' | 'device', key: string): Promise<T | undefined> {
    const database = await this.open();
    const request = database.transaction(store, 'readonly').objectStore(store).get(key);
    return requestResult<T | undefined>(request);
  }

  private async write(store: 'scopes' | 'device', value: unknown): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(store, 'readwrite');
    transaction.objectStore(store).put(value);
    await transactionDone(transaction);
  }

  private open(): Promise<IDBDatabase> {
    this.database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('scopes'))
          request.result.createObjectStore('scopes', { keyPath: 'key' });
        if (!request.result.objectStoreNames.contains('device'))
          request.result.createObjectStore('device', { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('No fue posible abrir IndexedDB.'));
    });
    return this.database;
  }
}

function entityKey(entity: OfflineEntity): string {
  return `${entity.kind}:${entity.id}`;
}
function sessionMatchesScope(session: SessionData, scope: OfflineScope): boolean {
  return (
    session.tenant.id === scope.tenantId &&
    session.user.id === scope.userId &&
    (session.context.branch?.id ?? null) === scope.branchId &&
    (session.context.cashRegister?.id ?? null) === scope.cashRegisterId
  );
}
function deduplicate(entities: readonly OfflineEntity[]): readonly OfflineEntity[] {
  return [...new Map(entities.map((entity) => [entityKey(entity), entity])).values()];
}
function assertSafe(value: unknown): void {
  const serialized = JSON.stringify(value).toLowerCase();
  if (FORBIDDEN.some((field) => serialized.includes(field.toLowerCase())))
    throw new Error('La operación contiene credenciales que no pueden guardarse offline.');
}
function safeError(error: unknown): unknown {
  return error instanceof Error ? { message: error.message } : { message: 'Error de conexión.' };
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
function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function transactionDone(
  transaction: IDBTransaction,
  start?: (transaction: IDBTransaction) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
    start?.(transaction);
  });
}
