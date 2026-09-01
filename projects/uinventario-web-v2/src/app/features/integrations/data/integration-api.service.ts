import { Injectable, inject } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { ApiClient } from '../../../core/api/api-client';
import { ApiEnvelope } from '../../../core/api/api-contracts';
import { IntegrationGateway } from '../domain/integration.gateway';
import {
  AdapterCapability,
  AdapterCatalogItem,
  AdapterConfiguration,
  AdapterExecution,
  AdapterScenario,
  AdapterUpdate,
  EmailEvent,
  ProviderKey,
  ProviderSummary,
} from '../domain/integration.models';

interface AdapterResponse {
  readonly data: readonly AdapterConfiguration[];
  readonly meta: {
    readonly catalog: readonly AdapterCatalogItem[];
    readonly secrets: { readonly valuesAcceptedByApi: false };
  };
}

interface FiscalConfiguration {
  readonly providerProfile: 'SIMULATOR' | 'LIVE_GENERIC';
  readonly enabled: boolean;
}

interface FiscalResponse {
  readonly countryCode: string;
  readonly configuration: FiscalConfiguration | null;
  readonly contract: { readonly version: string } | null;
  readonly validation: {
    readonly valid: boolean;
    readonly missingRequirements: readonly string[];
  } | null;
}

interface ActivityRecord {
  readonly status?: string;
  readonly errorCode?: string | null;
}

@Injectable()
export class IntegrationApi extends IntegrationGateway {
  private readonly api = inject(ApiClient);

  override adapters() {
    return this.api.get<AdapterResponse>('/integrations/adapters').pipe(
      map(({ data, meta }) => ({
        configurations: data,
        catalog: meta.catalog,
      })),
    );
  }

  override executions() {
    return this.data<readonly AdapterExecution[]>(
      this.api.get('/integrations/adapters/executions'),
    );
  }

  override emailEvents() {
    return this.data<readonly EmailEvent[]>(this.api.get('/integrations/adapters/email-events'));
  }

  override provider(key: ProviderKey): Observable<ProviderSummary> {
    switch (key) {
      case 'fiscal':
        return this.fiscal();
      case 'erp':
        return this.erp();
      case 'psp':
        return this.psp();
      case 'accounting':
        return this.accounting();
      case 'whatsapp':
        return this.whatsapp();
    }
  }

  override updateAdapter(input: AdapterUpdate) {
    const { capability, ...body } = input;
    return this.data<AdapterConfiguration>(
      this.api.put(`/integrations/adapters/${capability}`, body),
    );
  }

  override diagnose(capability: AdapterCapability, scenario: AdapterScenario) {
    return this.data<AdapterExecution>(
      this.api.post(
        `/integrations/adapters/${capability}/diagnostics`,
        { scenario },
        { headers: { 'Idempotency-Key': `adapter-${capability}-${crypto.randomUUID()}` } },
      ),
    );
  }

  private fiscal(): Observable<ProviderSummary> {
    return forkJoin({
      configuration: this.data<FiscalResponse>(this.api.get('/integrations/fiscal/configuration')),
      documents: this.data<readonly ActivityRecord[]>(
        this.api.get('/integrations/fiscal/simulator/documents'),
      ),
    }).pipe(
      map(({ configuration, documents }) => {
        const errors = this.errors(documents);
        return {
          key: 'fiscal',
          label: 'Fiscalidad',
          contractVersion: configuration.contract?.version ?? '1',
          mode: configuration.configuration
            ? configuration.configuration.providerProfile === 'SIMULATOR'
              ? 'SIMULATOR'
              : 'LIVE'
            : 'NOT_CONFIGURED',
          health:
            configuration.validation?.valid && !errors
              ? 'HEALTHY'
              : configuration.validation
                ? 'DEGRADED'
                : 'UNKNOWN',
          activityCount: documents.length,
          errorCount: errors,
          detail: configuration.configuration?.enabled
            ? `${configuration.countryCode} · emisión habilitada`
            : `${configuration.countryCode} · emisión deshabilitada`,
        } satisfies ProviderSummary;
      }),
    );
  }

  private erp(): Observable<ProviderSummary> {
    return this.data<{
      readonly version: string;
      readonly mode: 'SIMULATOR';
      readonly resources: readonly unknown[];
    }>(this.api.get('/integrations/erp/v1/contract')).pipe(
      map((contract) => ({
        key: 'erp',
        label: 'ERP',
        contractVersion: contract.version,
        mode: contract.mode,
        health: 'HEALTHY',
        activityCount: contract.resources.length,
        errorCount: 0,
        detail: `${contract.resources.length} recursos versionados`,
      })),
    );
  }

  private psp(): Observable<ProviderSummary> {
    return forkJoin({
      contract: this.data<{
        readonly version: string;
        readonly activeProvider: { readonly mode: 'SIMULATOR' | 'LIVE' };
      }>(this.api.get('/integrations/psp/v1/contract')),
      payments: this.data<readonly ActivityRecord[]>(this.api.get('/integrations/psp/v1/payments')),
    }).pipe(
      map(({ contract, payments }) => ({
        key: 'psp',
        label: 'Pagos (PSP)',
        contractVersion: contract.version,
        mode: contract.activeProvider.mode,
        health: this.health(payments),
        activityCount: payments.length,
        errorCount: this.errors(payments),
        detail: `${payments.length} pagos observables`,
      })),
    );
  }

  private accounting(): Observable<ProviderSummary> {
    return forkJoin({
      contract: this.data<{ readonly journalStatus: string }>(
        this.api.get('/integrations/accounting/v1/contract'),
      ),
      configuration: this.data<Record<string, unknown> | null>(
        this.api.get('/integrations/accounting/v1/config'),
      ),
      events: this.data<readonly ActivityRecord[]>(
        this.api.get('/integrations/accounting/v1/events'),
      ),
    }).pipe(
      map(({ contract, configuration, events }) => ({
        key: 'accounting',
        label: 'Contabilidad',
        contractVersion: '1',
        mode: configuration ? 'SIMULATOR' : 'NOT_CONFIGURED',
        health: configuration ? this.health(events) : 'UNKNOWN',
        activityCount: events.length,
        errorCount: this.errors(events),
        detail: configuration ? contract.journalStatus : 'Plan contable pendiente',
      })),
    );
  }

  private whatsapp(): Observable<ProviderSummary> {
    return forkJoin({
      contract: this.data<{ readonly templates: readonly string[] }>(
        this.api.get('/integrations/whatsapp/v1/contract'),
      ),
      consents: this.data<readonly unknown[]>(this.api.get('/integrations/whatsapp/v1/consents')),
      messages: this.data<readonly ActivityRecord[]>(
        this.api.get('/integrations/whatsapp/v1/messages'),
      ),
    }).pipe(
      map(({ contract, consents, messages }) => ({
        key: 'whatsapp',
        label: 'WhatsApp',
        contractVersion: '1',
        mode: 'SIMULATOR',
        health: this.health(messages),
        activityCount: messages.length,
        errorCount: this.errors(messages),
        detail: `${consents.length} consentimientos · ${contract.templates.length} plantillas`,
      })),
    );
  }

  private data<T>(request: Observable<unknown>) {
    return (request as Observable<ApiEnvelope<T>>).pipe(map(({ data }) => data));
  }

  private errors(records: readonly ActivityRecord[]): number {
    return records.filter(
      ({ status, errorCode }) =>
        Boolean(errorCode) ||
        ['REJECTED', 'FAILED', 'TIMED_OUT', 'TIMEOUT', 'DECLINED', 'INDETERMINATE'].includes(
          status ?? '',
        ),
    ).length;
  }

  private health(records: readonly ActivityRecord[]): ProviderSummary['health'] {
    if (!records.length) return 'UNKNOWN';
    return this.errors(records) ? 'DEGRADED' : 'HEALTHY';
  }
}
