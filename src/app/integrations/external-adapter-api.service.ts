import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export type ExternalAdapterCapability = 'NOTIFICATION_EMAIL' | 'NOTIFICATION_PUSH';
export type ExternalAdapterScenario = 'SUCCESS' | 'REJECT' | 'TIMEOUT' | 'RETRY';
export type ExternalAdapterStatus =
  'PENDING' | 'SUCCEEDED' | 'REJECTED' | 'RETRYABLE_FAILURE' | 'TIMED_OUT';

export interface ExternalAdapterConfigData {
  id: string;
  capability: ExternalAdapterCapability;
  countryCode: string;
  provider: string;
  adapterVersion: string;
  enabled: boolean;
  timeoutMs: number;
  maxAttempts: number;
  secretReference: string | null;
  updatedAt: string;
}

export interface ExternalAdapterExecutionData {
  id: string;
  capability: ExternalAdapterCapability;
  provider: string;
  adapterVersion: string;
  idempotencyKey: string;
  correlationId: string;
  status: ExternalAdapterStatus;
  attemptCount: number;
  errorCode: string | null;
  providerReference: string | null;
  durationMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalEmailEventData {
  webhookEventId: string;
  provider: string;
  providerReference: string;
  eventType:
    'SENT' | 'DELIVERED' | 'DELIVERY_DELAYED' | 'BOUNCED' | 'FAILED' | 'SUPPRESSED' | 'COMPLAINED';
  errorCode: string | null;
  occurredAt: string;
  receivedAt: string;
}

export interface ExternalAdapterCatalogItem {
  capability: ExternalAdapterCapability;
  provider: string;
  version: string;
  mode: 'SIMULATOR' | 'LIVE';
}

interface ApiResponse<T, TMeta = { apiVersion: '1' }> {
  data: T;
  meta: TMeta;
}

@Injectable({ providedIn: 'root' })
export class ExternalAdapterApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  configurations() {
    return this.http.get<
      ApiResponse<
        ExternalAdapterConfigData[],
        {
          apiVersion: '1';
          catalog: ExternalAdapterCatalogItem[];
          secrets: { storage: string; valuesAcceptedByApi: false };
        }
      >
    >(`${this.config.apiBaseUrl()}/integrations/adapters`, { withCredentials: true });
  }

  update(configuration: ExternalAdapterConfigData) {
    return this.http.put<ApiResponse<ExternalAdapterConfigData>>(
      `${this.config.apiBaseUrl()}/integrations/adapters/${configuration.capability}`,
      {
        countryCode: configuration.countryCode,
        provider: configuration.provider,
        adapterVersion: configuration.adapterVersion,
        enabled: configuration.enabled,
        timeoutMs: configuration.timeoutMs,
        maxAttempts: configuration.maxAttempts,
        secretReference: configuration.secretReference || null,
      },
      { withCredentials: true },
    );
  }

  diagnose(capability: ExternalAdapterCapability, scenario: ExternalAdapterScenario) {
    return this.http.post<ApiResponse<ExternalAdapterExecutionData>>(
      `${this.config.apiBaseUrl()}/integrations/adapters/${capability}/diagnostics`,
      { scenario },
      {
        withCredentials: true,
        headers: { 'Idempotency-Key': `adapter-${capability}-${crypto.randomUUID()}` },
      },
    );
  }

  executions() {
    return this.http.get<ApiResponse<ExternalAdapterExecutionData[]>>(
      `${this.config.apiBaseUrl()}/integrations/adapters/executions`,
      { withCredentials: true },
    );
  }

  emailEvents() {
    return this.http.get<ApiResponse<ExternalEmailEventData[]>>(
      `${this.config.apiBaseUrl()}/integrations/adapters/email-events`,
      { withCredentials: true },
    );
  }
}
