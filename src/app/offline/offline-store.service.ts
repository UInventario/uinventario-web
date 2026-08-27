import { Injectable } from '@angular/core';
import {
  OfflineBootstrapData,
  OfflineBootstrapEntity,
  OfflineChange,
} from './offline-bootstrap-api.service';

const DATABASE_NAME = 'uinventario-offline';
export const OFFLINE_SCHEMA_VERSION = 2;

interface MetaRecord {
  key: string;
  value: string;
}

interface ScopeRecord {
  key: string;
  protocolVersion: string;
  tenantId: string;
  userId: string;
  deviceId: string;
  branchId: string | null;
  cashRegisterId: string | null;
  initialSyncCursor: string;
  generatedAt: string;
  storedAt: string;
}

interface EntityRecord {
  storageKey: string;
  scopeKey: string;
  value: OfflineBootstrapEntity;
}

export interface OfflineScopeIdentity {
  tenantId: string;
  userId: string;
  deviceId: string;
  branchId: string | null;
  cashRegisterId: string | null;
}

export interface OfflineStoredSummary {
  entities: number;
  generatedAt: string;
  storedAt: string;
  cursor: string;
}

export interface OfflineOutboxCommand {
  protocolVersion: '1.0';
  commandId: string;
  scopeKey: string;
  scope: OfflineScopeIdentity;
  idempotencyKey: string;
  sequence: number;
  kind: 'CASH_SALE' | 'INVENTORY_COUNT' | 'INVENTORY_MOVEMENT';
  payload: Readonly<Record<string, unknown>>;
  createdAt: string;
  status: 'PENDING' | 'SENT' | 'CONFIRMED' | 'ERROR';
  attempts: number;
  nextAttemptAt: string | null;
  retryable: boolean;
  lastError: unknown | null;
  result: unknown | null;
}

export interface OfflineCommandServerResult {
  commandId: string;
  sequence: number;
  status: 'CONFIRMED' | 'ERROR';
  replay: boolean;
  result?: unknown;
  error?: unknown;
}

export class OfflineStorageError extends Error {
  constructor(
    readonly code: 'UNAVAILABLE' | 'QUOTA' | 'MIGRATION' | 'WRITE_FAILED',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

@Injectable({ providedIn: 'root' })
export class OfflineStoreService {
  private database: Promise<IDBDatabase> | undefined;

  async deviceId(): Promise<string> {
    const database = await this.open();
    const existing = await this.request<MetaRecord | undefined>(
      database.transaction('meta').objectStore('meta').get('deviceId'),
    );
    if (existing?.value) return existing.value;
    const value = crypto.randomUUID();
    const transaction = database.transaction('meta', 'readwrite');
    transaction.objectStore('meta').put({ key: 'deviceId', value } satisfies MetaRecord);
    await this.transaction(transaction);
    return value;
  }

  async replaceBootstrap(
    bootstrap: OfflineBootstrapData,
    entities: OfflineBootstrapEntity[],
  ): Promise<void> {
    const scope = bootstrap.scope;
    await this.clearIncompatible(scope);
    const database = await this.open();
    const scopeKey = this.scopeKey(scope);
    const transaction = database.transaction(['scopes', 'entities'], 'readwrite');
    const entityStore = transaction.objectStore('entities');
    const scopeStore = transaction.objectStore('scopes');
    const cursor = entityStore.index('scopeKey').openCursor(IDBKeyRange.only(scopeKey));
    cursor.onsuccess = () => {
      const current = cursor.result;
      if (current) {
        current.delete();
        current.continue();
        return;
      }
      const storedEntities = bootstrap.posPolicy ? [...entities, bootstrap.posPolicy] : entities;
      for (const entity of storedEntities) {
        entityStore.put({
          storageKey: `${scopeKey}:${entity.kind}:${entity.id}`,
          scopeKey,
          value: entity,
        } satisfies EntityRecord);
      }
      scopeStore.put({
        key: scopeKey,
        ...scope,
        protocolVersion: bootstrap.protocolVersion,
        initialSyncCursor: bootstrap.page.initialSyncCursor,
        generatedAt: bootstrap.generatedAt,
        storedAt: new Date().toISOString(),
      } satisfies ScopeRecord);
    };
    await this.safeTransaction(transaction);
  }

  async summary(scope: OfflineScopeIdentity): Promise<OfflineStoredSummary | null> {
    const database = await this.open();
    const key = this.scopeKey(scope);
    const storedScope = await this.request<ScopeRecord | undefined>(
      database.transaction('scopes').objectStore('scopes').get(key),
    );
    if (!storedScope) return null;
    const entities = await this.request<number>(
      database
        .transaction('entities')
        .objectStore('entities')
        .index('scopeKey')
        .count(IDBKeyRange.only(key)),
    );
    return {
      entities,
      generatedAt: storedScope.generatedAt,
      storedAt: storedScope.storedAt,
      cursor: storedScope.initialSyncCursor,
    };
  }

  async applyChanges(
    scope: OfflineScopeIdentity,
    changes: OfflineChange[],
    nextCursor: string,
  ): Promise<void> {
    const database = await this.open();
    const key = this.scopeKey(scope);
    const transaction = database.transaction(['scopes', 'entities'], 'readwrite');
    const scopes = transaction.objectStore('scopes');
    const entities = transaction.objectStore('entities');
    const request = scopes.get(key) as IDBRequest<ScopeRecord | undefined>;
    request.onsuccess = () => {
      const stored = request.result;
      if (!stored) {
        transaction.abort();
        return;
      }
      for (const change of changes) {
        const storageKey = `${key}:${change.entity.kind}:${change.entity.id}`;
        if (change.operation === 'DELETE') {
          entities.delete(storageKey);
        } else {
          entities.put({ storageKey, scopeKey: key, value: change.entity } satisfies EntityRecord);
        }
      }
      scopes.put({
        ...stored,
        initialSyncCursor: nextCursor,
        generatedAt: new Date().toISOString(),
        storedAt: new Date().toISOString(),
      } satisfies ScopeRecord);
    };
    await this.safeTransaction(transaction);
  }

  async queue(
    scope: OfflineScopeIdentity,
    kind: OfflineOutboxCommand['kind'],
    payload: Readonly<Record<string, unknown>>,
    options: { idempotencyKey?: string } = {},
  ): Promise<OfflineOutboxCommand> {
    if (this.containsCredential(payload)) {
      throw new OfflineStorageError(
        'WRITE_FAILED',
        'El comando contiene credenciales que no pueden guardarse offline.',
      );
    }
    const database = await this.open();
    const scopeKey = this.scopeKey(scope);
    const transaction = database.transaction('outbox', 'readwrite');
    const store = transaction.objectStore('outbox');
    const request = store.index('scopeKey').getAll(IDBKeyRange.only(scopeKey));
    let command: OfflineOutboxCommand | undefined;
    request.onsuccess = () => {
      const sequence =
        request.result.reduce(
          (maximum, current) =>
            Math.max(maximum, Number((current as OfflineOutboxCommand).sequence ?? 0)),
          0,
        ) + 1;
      const commandId = crypto.randomUUID();
      command = {
        protocolVersion: '1.0',
        commandId,
        scopeKey,
        scope,
        idempotencyKey: options.idempotencyKey ?? `offline-${commandId}`,
        sequence,
        kind,
        payload,
        createdAt: new Date().toISOString(),
        status: 'PENDING',
        attempts: 0,
        nextAttemptAt: null,
        retryable: true,
        lastError: null,
        result: null,
      };
      store.put(command);
    };
    await this.safeTransaction(transaction);
    return command!;
  }

  async pending(scope: OfflineScopeIdentity): Promise<OfflineOutboxCommand[]> {
    const database = await this.open();
    const commands = await this.request<OfflineOutboxCommand[]>(
      database
        .transaction('outbox')
        .objectStore('outbox')
        .index('scopeKey')
        .getAll(IDBKeyRange.only(this.scopeKey(scope))),
    );
    const now = Date.now();
    const pending: OfflineOutboxCommand[] = [];
    for (const command of commands.sort((left, right) => left.sequence - right.sequence)) {
      if (command.status === 'CONFIRMED' || (command.status === 'ERROR' && !command.retryable)) {
        continue;
      }
      if (
        command.status === 'ERROR' &&
        command.nextAttemptAt &&
        new Date(command.nextAttemptAt).getTime() > now
      ) {
        break;
      }
      pending.push(command);
    }
    return pending;
  }

  async outbox(scope: OfflineScopeIdentity): Promise<OfflineOutboxCommand[]> {
    const database = await this.open();
    const commands = await this.request<OfflineOutboxCommand[]>(
      database
        .transaction('outbox')
        .objectStore('outbox')
        .index('scopeKey')
        .getAll(IDBKeyRange.only(this.scopeKey(scope))),
    );
    return commands.sort((left, right) => left.sequence - right.sequence);
  }

  async entities<T extends OfflineBootstrapEntity>(scope: OfflineScopeIdentity, kind: string) {
    const database = await this.open();
    const records = await this.request<EntityRecord[]>(
      database
        .transaction('entities')
        .objectStore('entities')
        .index('scopeKey')
        .getAll(IDBKeyRange.only(this.scopeKey(scope))),
    );
    return records.map(({ value }) => value).filter((entity): entity is T => entity.kind === kind);
  }

  async markSent(commandIds: string[]): Promise<void> {
    await this.updateCommands(commandIds, (command) => ({
      ...command,
      status: 'SENT',
      attempts: command.attempts + 1,
      nextAttemptAt: null,
      lastError: null,
    }));
  }

  async settle(results: OfflineCommandServerResult[]): Promise<void> {
    const byId = new Map(results.map((result) => [result.commandId, result]));
    await this.updateCommands([...byId.keys()], (command) => {
      const response = byId.get(command.commandId)!;
      return {
        ...command,
        status: response.status,
        retryable: false,
        nextAttemptAt: null,
        lastError: response.error ?? null,
        result: response.result ?? null,
      };
    });
  }

  async retry(commandIds: string[], error: unknown): Promise<void> {
    await this.updateCommands(commandIds, (command) => ({
      ...command,
      status: 'ERROR',
      retryable: true,
      nextAttemptAt: new Date(
        Date.now() +
          Math.min(5 * 60_000, 1_000 * 2 ** Math.min(9, Math.max(0, command.attempts - 1))),
      ).toISOString(),
      lastError: this.serializableError(error),
    }));
  }

  async retryNow(scope: OfflineScopeIdentity, commandId: string): Promise<void> {
    await this.updateScopedCommand(scope, commandId, (command) => {
      if (command.status !== 'ERROR' || !command.retryable) return command;
      return {
        ...command,
        status: 'PENDING',
        nextAttemptAt: null,
        lastError: null,
      };
    });
  }

  async rejectPending(scope: OfflineScopeIdentity, commandId: string): Promise<void> {
    const database = await this.open();
    const key = this.scopeKey(scope);
    const transaction = database.transaction('outbox', 'readwrite');
    const store = transaction.objectStore('outbox');
    const request = store.index('scopeKey').getAll(IDBKeyRange.only(key));
    request.onsuccess = () => {
      const commands = (request.result as OfflineOutboxCommand[]).sort(
        (left, right) => left.sequence - right.sequence,
      );
      const rejected = commands.find(({ commandId: id }) => id === commandId);
      if (!rejected || rejected.status !== 'PENDING' || rejected.attempts !== 0) return;
      store.delete(rejected.commandId);
      for (const command of commands) {
        if (command.sequence > rejected.sequence && command.attempts === 0) {
          store.put({ ...command, sequence: command.sequence - 1 });
        }
      }
    };
    await this.safeTransaction(transaction);
  }

  async clearAll(): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(['scopes', 'entities', 'outbox'], 'readwrite');
    transaction.objectStore('scopes').clear();
    transaction.objectStore('entities').clear();
    transaction.objectStore('outbox').clear();
    await this.safeTransaction(transaction);
  }

  scopeKey(scope: OfflineScopeIdentity): string {
    return [
      scope.tenantId,
      scope.userId,
      scope.deviceId,
      scope.branchId ?? '-',
      scope.cashRegisterId ?? '-',
    ].join(':');
  }

  async clearIncompatible(scope: OfflineScopeIdentity): Promise<void> {
    const database = await this.open();
    const scopes = await this.request<ScopeRecord[]>(
      database.transaction('scopes').objectStore('scopes').getAll(),
    );
    for (const stored of scopes) {
      if (
        stored.tenantId !== scope.tenantId ||
        stored.userId !== scope.userId ||
        stored.deviceId !== scope.deviceId
      ) {
        await this.deleteScope(stored.key);
      }
    }
  }

  private async deleteScope(scopeKey: string): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(['scopes', 'entities', 'outbox'], 'readwrite');
    transaction.objectStore('scopes').delete(scopeKey);
    for (const storeName of ['entities', 'outbox'] as const) {
      const request = transaction
        .objectStore(storeName)
        .index('scopeKey')
        .openCursor(IDBKeyRange.only(scopeKey));
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    }
    await this.safeTransaction(transaction);
  }

  private open(): Promise<IDBDatabase> {
    if (this.database) return this.database;
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(
        new OfflineStorageError(
          'UNAVAILABLE',
          'El almacenamiento offline no está disponible. Puedes seguir trabajando en línea.',
        ),
      );
    }
    this.database = this.openOnce().catch(async (cause: unknown) => {
      await this.deleteDatabase();
      try {
        return await this.openOnce();
      } catch (retryCause) {
        this.database = undefined;
        throw new OfflineStorageError(
          'MIGRATION',
          'No fue posible recuperar el almacenamiento offline. Puedes seguir trabajando en línea.',
          { cause: retryCause ?? cause },
        );
      }
    });
    return this.database;
  }

  private openOnce(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, OFFLINE_SCHEMA_VERSION);
      request.onupgradeneeded = (event) => {
        const database = request.result;
        if (!database.objectStoreNames.contains('meta')) {
          database.createObjectStore('meta', { keyPath: 'key' });
        }
        if (!database.objectStoreNames.contains('scopes')) {
          database.createObjectStore('scopes', { keyPath: 'key' });
        }
        if (!database.objectStoreNames.contains('entities')) {
          const entities = database.createObjectStore('entities', { keyPath: 'storageKey' });
          entities.createIndex('scopeKey', 'scopeKey', { unique: false });
        }
        if (!database.objectStoreNames.contains('outbox')) {
          const outbox = database.createObjectStore('outbox', { keyPath: 'commandId' });
          outbox.createIndex('scopeKey', 'scopeKey', { unique: false });
          outbox.createIndex('scopeSequence', ['scopeKey', 'sequence'], { unique: true });
        } else {
          const outbox = request.transaction!.objectStore('outbox');
          if ((event as IDBVersionChangeEvent).oldVersion < 2) outbox.clear();
          if (!outbox.indexNames.contains('scopeSequence')) {
            outbox.createIndex('scopeSequence', ['scopeKey', 'sequence'], { unique: true });
          }
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        if (!this.validSchema(database)) {
          database.close();
          reject(new Error('INVALID_OFFLINE_SCHEMA'));
          return;
        }
        resolve(database);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('INDEXEDDB_BLOCKED'));
    });
  }

  private validSchema(database: IDBDatabase): boolean {
    if (
      !['meta', 'scopes', 'entities', 'outbox'].every((name) =>
        database.objectStoreNames.contains(name),
      )
    ) {
      return false;
    }
    try {
      const transaction = database.transaction(['entities', 'outbox']);
      return (
        transaction.objectStore('entities').indexNames.contains('scopeKey') &&
        transaction.objectStore('outbox').indexNames.contains('scopeKey') &&
        transaction.objectStore('outbox').indexNames.contains('scopeSequence')
      );
    } catch {
      return false;
    }
  }

  private containsCredential(value: unknown, visited = new WeakSet<object>()): boolean {
    if (!value || typeof value !== 'object') return false;
    if (visited.has(value)) return false;
    visited.add(value);
    for (const [key, child] of Object.entries(value)) {
      if (/(?:password|token|secret|authorization|cookie|credential)/i.test(key)) return true;
      if (this.containsCredential(child, visited)) return true;
    }
    return false;
  }

  private serializableError(error: unknown): unknown {
    if (error instanceof Error) return { name: error.name, message: error.message };
    if (typeof error === 'string' || error === null) return error;
    try {
      return JSON.parse(JSON.stringify(error)) as unknown;
    } catch {
      return 'Error de sincronización no serializable';
    }
  }

  private async updateCommands(
    commandIds: string[],
    update: (command: OfflineOutboxCommand) => OfflineOutboxCommand,
  ): Promise<void> {
    if (!commandIds.length) return;
    const database = await this.open();
    const transaction = database.transaction('outbox', 'readwrite');
    const store = transaction.objectStore('outbox');
    for (const commandId of commandIds) {
      const request = store.get(commandId) as IDBRequest<OfflineOutboxCommand | undefined>;
      request.onsuccess = () => {
        if (request.result) store.put(update(request.result));
      };
    }
    await this.safeTransaction(transaction);
  }

  private async updateScopedCommand(
    scope: OfflineScopeIdentity,
    commandId: string,
    update: (command: OfflineOutboxCommand) => OfflineOutboxCommand,
  ): Promise<void> {
    const key = this.scopeKey(scope);
    await this.updateCommands([commandId], (command) =>
      command.scopeKey === key ? update(command) : command,
    );
  }

  private deleteDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DATABASE_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('INDEXEDDB_DELETE_BLOCKED'));
    });
  }

  private request<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private transaction(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  private async safeTransaction(transaction: IDBTransaction): Promise<void> {
    try {
      await this.transaction(transaction);
    } catch (cause) {
      const quota = cause instanceof DOMException && cause.name === 'QuotaExceededError';
      throw new OfflineStorageError(
        quota ? 'QUOTA' : 'WRITE_FAILED',
        quota
          ? 'No hay espacio suficiente para guardar datos offline. Puedes seguir trabajando en línea.'
          : 'No fue posible guardar datos offline. Puedes seguir trabajando en línea.',
        { cause },
      );
    }
  }
}
