import { Injectable } from '@angular/core';
import { OfflineBootstrapData, OfflineBootstrapEntity } from './offline-bootstrap-api.service';

const DATABASE_NAME = 'uinventario-offline';
export const OFFLINE_SCHEMA_VERSION = 1;

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
}

export interface OfflineOutboxCommand {
  commandId: string;
  scopeKey: string;
  idempotencyKey: string;
  type: string;
  payload: unknown;
  createdAt: string;
  attempts: number;
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
      for (const entity of entities) {
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
    };
  }

  async enqueue(command: OfflineOutboxCommand): Promise<void> {
    if (this.containsCredential(command.payload)) {
      throw new OfflineStorageError(
        'WRITE_FAILED',
        'El comando contiene credenciales que no pueden guardarse offline.',
      );
    }
    const database = await this.open();
    const transaction = database.transaction('outbox', 'readwrite');
    transaction.objectStore('outbox').put(command);
    await this.safeTransaction(transaction);
  }

  async pending(scope: OfflineScopeIdentity): Promise<OfflineOutboxCommand[]> {
    const database = await this.open();
    return this.request<OfflineOutboxCommand[]>(
      database
        .transaction('outbox')
        .objectStore('outbox')
        .index('scopeKey')
        .getAll(IDBKeyRange.only(this.scopeKey(scope))),
    );
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
      request.onupgradeneeded = () => {
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
        transaction.objectStore('outbox').indexNames.contains('scopeKey')
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
