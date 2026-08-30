import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export type ErpResource =
  'PRODUCT' | 'SUPPLIER' | 'CUSTOMER' | 'PURCHASE_ORDER' | 'PURCHASE_RECEIPT' | 'SALE';

export interface ErpContractData {
  name: 'UINVENTARIO_ERP_EXCHANGE';
  version: '1';
  mode: 'SIMULATOR';
  production: false;
  resources: Array<{
    resource: ErpResource;
    directions: Array<'EXPORT_INCREMENTAL' | 'IMPORT_IDENTITY_MAPPING'>;
  }>;
  guarantees: Record<string, boolean>;
}

export interface ErpExportData {
  resource: ErpResource;
  internalId: string;
  externalId: string | null;
  payload: Record<string, unknown>;
  changedAt: string;
}

export interface ErpMappingResult {
  index: number;
  resource: ErpResource;
  externalId: string;
  internalId: string;
  status: 'LINKED' | 'ERROR';
  replay: boolean;
  errorCode: 'INTERNAL_RECORD_NOT_FOUND' | 'MAPPING_CONFLICT' | null;
}

export interface ErpMappingData {
  id: string;
  resource: ErpResource;
  externalId: string;
  internalId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ErpImportRunData {
  id: string;
  provider: string;
  status: 'PENDING' | 'COMPLETED';
  results: ErpMappingResult[];
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class ErpIntegrationApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);
  private readonly baseUrl = `${this.config.apiBaseUrl()}/integrations/erp/v1`;

  contract() {
    return this.http.get<{ data: ErpContractData; meta: { apiVersion: '1' } }>(
      `${this.baseUrl}/contract`,
      { withCredentials: true },
    );
  }

  export(provider: string, resource: ErpResource, cursor?: string) {
    let params = new HttpParams()
      .set('provider', provider)
      .set('resource', resource)
      .set('limit', 20);
    if (cursor) params = params.set('cursor', cursor);
    return this.http.get<{
      data: ErpExportData[];
      meta: {
        apiVersion: '1';
        provider: string;
        resource: ErpResource;
        hasMore: boolean;
        nextCursor: string | null;
      };
    }>(`${this.baseUrl}/exports`, { params, withCredentials: true });
  }

  importMappings(
    provider: string,
    records: Array<{ resource: ErpResource; externalId: string; internalId: string }>,
  ) {
    return this.http.post<{
      data: {
        runId: string;
        status: 'COMPLETED';
        summary: { total: number; linked: number; failed: number };
        results: ErpMappingResult[];
      };
      meta: { apiVersion: '1'; provider: string; idempotentReplay: boolean };
    }>(
      `${this.baseUrl}/mappings/imports`,
      { provider, records },
      {
        headers: new HttpHeaders({
          'Idempotency-Key': `web-erp-import-${crypto.randomUUID()}`,
        }),
        withCredentials: true,
      },
    );
  }

  mappings(provider: string) {
    return this.http.get<{
      data: ErpMappingData[];
      meta: { apiVersion: '1'; provider: string };
    }>(`${this.baseUrl}/mappings`, {
      params: { provider },
      withCredentials: true,
    });
  }

  runs(provider: string) {
    return this.http.get<{
      data: ErpImportRunData[];
      meta: { apiVersion: '1'; provider: string };
    }>(`${this.baseUrl}/imports`, {
      params: { provider },
      withCredentials: true,
    });
  }
}
