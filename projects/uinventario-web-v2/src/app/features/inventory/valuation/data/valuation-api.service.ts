import { HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../../../../core/api/api-client';
import { ApiEnvelope } from '../../../../core/api/api-contracts';
import { ValuationGateway } from '../domain/valuation.gateway';
import {
  FifoLayer,
  FifoLayerSet,
  Pagination,
  ReconciliationRun,
  ValuationMigrationPlan,
  ValuationMethod,
  ValuationPolicy,
  ValuationStockItem,
  ValuationStockPage,
  ValuationStockQuery,
  ValuedMovement,
} from '../domain/valuation.models';

interface StockResponse {
  readonly data: readonly ValuationStockItem[];
  readonly meta: {
    readonly scope: ValuationStockPage['scope'];
    readonly valuation: ValuationStockPage['valuation'];
    readonly pagination: Pagination;
  };
}

interface FifoResponse {
  readonly data: readonly FifoLayer[];
  readonly meta: FifoLayerSet['meta'];
}

interface MovementResponse {
  readonly data: readonly ValuedMovement[];
  readonly meta: { readonly pagination: Pagination };
}

@Injectable()
export class ValuationApi extends ValuationGateway {
  private readonly api = inject(ApiClient);

  override policy() {
    return this.data(this.api.get<ApiEnvelope<ValuationPolicy>>('/inventory/valuation-policy'));
  }

  override previewPolicy(method: ValuationMethod) {
    return this.data(
      this.api.post<
        ApiEnvelope<ValuationMigrationPlan>,
        { readonly targetMethod: ValuationMethod }
      >('/inventory/valuation-policy/preview', { targetMethod: method }),
    );
  }

  override changePolicy(plan: ValuationMigrationPlan, idempotencyKey: string) {
    return this.data(
      this.api.post<
        ApiEnvelope<ValuationPolicy>,
        {
          readonly targetMethod: ValuationMethod;
          readonly expectedVersion: number;
          readonly planFingerprint: string;
        }
      >(
        '/inventory/valuation-policy/changes',
        {
          targetMethod: plan.targetMethod,
          expectedVersion: plan.current.version,
          planFingerprint: plan.planFingerprint,
        },
        { headers: this.idempotencyHeaders(idempotencyKey) },
      ),
    );
  }

  override stock(query: ValuationStockQuery) {
    const params: Record<string, string | number> = { page: query.page, pageSize: query.pageSize };
    if (query.q) params['q'] = query.q;
    return this.api.get<StockResponse>('/inventory/stock', { params }).pipe(
      map(({ data, meta }) => ({
        items: data,
        scope: meta.scope,
        valuation: meta.valuation,
        pagination: meta.pagination,
      })),
    );
  }

  override fifoLayers(productId: string) {
    return this.api
      .get<FifoResponse>(`/inventory/products/${encodeURIComponent(productId)}/fifo-layers`)
      .pipe(map(({ data, meta }) => ({ items: data, meta })));
  }

  override movements(productId: string, page: number) {
    return this.api
      .get<MovementResponse>('/inventory/movements', {
        params: { productId, page, pageSize: 20 },
      })
      .pipe(map(({ data, meta }) => ({ items: data, pagination: meta.pagination })));
  }

  override latestReconciliation() {
    return this.data(
      this.api.get<ApiEnvelope<ReconciliationRun | null>>('/inventory/reconciliations/latest'),
    );
  }

  override runReconciliation(idempotencyKey: string) {
    return this.data(
      this.api.post<ApiEnvelope<ReconciliationRun>, Record<string, never>>(
        '/inventory/reconciliations',
        {},
        { headers: this.idempotencyHeaders(idempotencyKey) },
      ),
    );
  }

  private data<T>(request: import('rxjs').Observable<ApiEnvelope<T>>) {
    return request.pipe(map(({ data }) => data));
  }

  private idempotencyHeaders(idempotencyKey: string): HttpHeaders {
    return new HttpHeaders({ 'Idempotency-Key': idempotencyKey });
  }
}
