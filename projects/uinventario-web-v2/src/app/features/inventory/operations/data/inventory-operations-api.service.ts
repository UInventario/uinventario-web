import { HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../../../../core/api/api-client';
import { ApiEnvelope } from '../../../../core/api/api-contracts';
import { InventoryOperationsGateway } from '../domain/inventory-operations.gateway';
import {
  AlertPage,
  AlertQuery,
  CountSession,
  CountSessionInput,
  ImportMode,
  InventoryImport,
  LocationOption,
  StockAlert,
} from '../domain/inventory-operations.models';

interface StockResponse {
  readonly data: readonly {
    readonly product: { readonly id: string; readonly name: string; readonly sku: string };
    readonly totalQuantity: string;
  }[];
}

interface AlertResponse {
  readonly data: readonly StockAlert[];
  readonly meta: Omit<AlertPage, 'items'>;
}

@Injectable()
export class InventoryOperationsApi extends InventoryOperationsGateway {
  private readonly api = inject(ApiClient);

  override listCounts() {
    return this.data(
      this.api.get<ApiEnvelope<readonly CountSession[]>>('/inventory/count-sessions'),
    );
  }

  override getCount(id: string) {
    return this.data(
      this.api.get<ApiEnvelope<CountSession>>(
        `/inventory/count-sessions/${encodeURIComponent(id)}`,
      ),
    );
  }

  override createCount(input: CountSessionInput, key: string) {
    return this.data(
      this.api.post<ApiEnvelope<CountSession>, CountSessionInput>(
        '/inventory/count-sessions',
        input,
        {
          headers: this.key(key),
        },
      ),
    );
  }

  override recordCount(
    sessionId: string,
    productId: string,
    countedQuantity: string,
    expectedAttempt: number,
  ) {
    return this.data(
      this.api.put<ApiEnvelope<CountSession>, { countedQuantity: string; expectedAttempt: number }>(
        `/inventory/count-sessions/${encodeURIComponent(sessionId)}/lines/${encodeURIComponent(productId)}`,
        { countedQuantity, expectedAttempt },
      ),
    );
  }

  override closeCount(sessionId: string, reason: string, reference: string) {
    return this.data(
      this.api.post<ApiEnvelope<CountSession>, { reason: string; reference: string }>(
        `/inventory/count-sessions/${encodeURIComponent(sessionId)}/close`,
        { reason, reference },
      ),
    );
  }

  override locations() {
    return this.data(this.api.get<ApiEnvelope<readonly LocationOption[]>>('/inventory/locations'));
  }

  override products(q?: string) {
    const params: Record<string, string | number> = { page: 1, pageSize: 100 };
    if (q) params['q'] = q;
    return this.api
      .get<StockResponse>('/inventory/stock', { params })
      .pipe(
        map(({ data }) =>
          data.map(({ product, totalQuantity }) => ({ ...product, quantity: totalQuantity })),
        ),
      );
  }

  override previewImport(file: File, mode: ImportMode) {
    const body = new FormData();
    body.append('mode', mode);
    body.append('file', file, file.name);
    return this.data(
      this.api.post<ApiEnvelope<InventoryImport>, FormData>('/inventory/imports/preview', body),
    );
  }

  override confirmImport(importId: string, key: string) {
    return this.data(
      this.api.post<ApiEnvelope<InventoryImport>, Record<string, never>>(
        `/inventory/imports/${encodeURIComponent(importId)}/confirm`,
        {},
        { headers: this.key(key) },
      ),
    );
  }

  override alerts(query: AlertQuery) {
    const params: Record<string, string | number> = { page: query.page, pageSize: query.pageSize };
    if (query.q) params['q'] = query.q;
    if (query.status) params['status'] = query.status;
    return this.api
      .get<AlertResponse>('/inventory/stock-alerts', { params })
      .pipe(map(({ data, meta }) => ({ items: data, ...meta })));
  }

  override setThreshold(alert: StockAlert, threshold: string) {
    return this.data(
      this.api.put<ApiEnvelope<StockAlert>, { threshold: string }>(
        `/inventory/stock-alerts/products/${encodeURIComponent(alert.product.id)}/locations/${encodeURIComponent(alert.location.id)}/threshold`,
        { threshold },
      ),
    );
  }

  private data<T>(request: import('rxjs').Observable<ApiEnvelope<T>>) {
    return request.pipe(map(({ data }) => data));
  }

  private key(value: string): HttpHeaders {
    return new HttpHeaders({ 'Idempotency-Key': value });
  }
}
