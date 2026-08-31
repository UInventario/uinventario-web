export type AdapterCapability =
  'NOTIFICATION_EMAIL' | 'NOTIFICATION_PUSH' | 'NOTIFICATION_WHATSAPP';

export type AdapterScenario = 'SUCCESS' | 'REJECT' | 'TIMEOUT' | 'RETRY';
export type AdapterStatus =
  'PENDING' | 'SUCCEEDED' | 'REJECTED' | 'RETRYABLE_FAILURE' | 'TIMED_OUT';
export type ProviderKey = 'fiscal' | 'erp' | 'psp' | 'accounting' | 'whatsapp';

export interface AdapterConfiguration {
  readonly id: string;
  readonly capability: AdapterCapability;
  readonly countryCode: string;
  readonly provider: string;
  readonly adapterVersion: string;
  readonly enabled: boolean;
  readonly timeoutMs: number;
  readonly maxAttempts: number;
  readonly secretReference: string | null;
  readonly updatedAt: string;
}

export interface AdapterCatalogItem {
  readonly capability: AdapterCapability;
  readonly provider: string;
  readonly version: string;
  readonly mode: 'SIMULATOR' | 'LIVE';
}

export interface AdapterExecution {
  readonly id: string;
  readonly capability: AdapterCapability;
  readonly provider: string;
  readonly adapterVersion: string;
  readonly status: AdapterStatus;
  readonly attemptCount: number;
  readonly errorCode: string | null;
  readonly durationMs: number;
  readonly createdAt: string;
}

export interface EmailEvent {
  readonly webhookEventId: string;
  readonly provider: string;
  readonly eventType: string;
  readonly errorCode: string | null;
  readonly occurredAt: string;
}

export interface ProviderSummary {
  readonly key: ProviderKey;
  readonly label: string;
  readonly contractVersion: string;
  readonly mode: 'SIMULATOR' | 'LIVE' | 'NOT_CONFIGURED';
  readonly health: 'HEALTHY' | 'DEGRADED' | 'UNKNOWN';
  readonly activityCount: number;
  readonly errorCount: number;
  readonly detail: string;
}

export interface LoadResult<T> {
  readonly data: T | null;
  readonly error: string | null;
}

export interface IntegrationSnapshot {
  readonly adapters: LoadResult<{
    readonly configurations: readonly AdapterConfiguration[];
    readonly catalog: readonly AdapterCatalogItem[];
  }>;
  readonly executions: LoadResult<readonly AdapterExecution[]>;
  readonly emailEvents: LoadResult<readonly EmailEvent[]>;
  readonly providers: readonly LoadResult<ProviderSummary>[];
}

export interface AdapterUpdate {
  readonly capability: AdapterCapability;
  readonly countryCode: string;
  readonly provider: string;
  readonly adapterVersion: string;
  readonly enabled: boolean;
  readonly timeoutMs: number;
  readonly maxAttempts: number;
  readonly secretReference: string | null;
}
