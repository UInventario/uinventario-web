import { HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, from, map, throwError } from 'rxjs';
import { ApiError } from '../../../core/api/api-error';
import { ApiClient } from '../../../core/api/api-client';
import { ApiEnvelope } from '../../../core/api/api-contracts';
import { InventoryGateway } from '../domain/inventory.gateway';
import { OfflineInventory } from './offline-inventory.service';
import {
  InventoryLocation,
  InventoryMovement,
  InventoryMovementInput,
  InventoryMovementPage,
  InventoryProductDetails,
  InventoryStateTransitionInput,
  InventoryStockItem,
  InventoryStockPage,
  MovementQuery,
  Pagination,
  StockQuery,
} from '../domain/inventory.models';

interface StockResponse {
  readonly data: readonly InventoryStockItem[];
  readonly meta: {
    readonly scope: InventoryStockPage['scope'];
    readonly valuation: { readonly currency: string };
    readonly pagination: Pagination;
  };
}

interface MovementResponse {
  readonly data: readonly InventoryMovement[];
  readonly meta: {
    readonly scope: { readonly branch: InventoryMovementPage['branch'] };
    readonly pagination: Pagination;
  };
}

@Injectable()
export class InventoryApi extends InventoryGateway {
  private readonly api = inject(ApiClient);
  private readonly offline = inject(OfflineInventory);

  override listStock(query: StockQuery) {
    return this.api
      .get<StockResponse>('/inventory/stock', { params: this.queryParams(query) })
      .pipe(
        map(({ data, meta }) => ({
          items: data,
          scope: meta.scope,
          currency: meta.valuation.currency,
          pagination: meta.pagination,
        })),
        catchError((error: unknown) => this.fallback(error, () => this.offline.listStock(query))),
      );
  }

  override listMovements(query: MovementQuery) {
    return this.api
      .get<MovementResponse>('/inventory/movements', { params: this.queryParams(query) })
      .pipe(
        map(({ data, meta }) => ({
          items: data,
          branch: meta.scope.branch,
          pagination: meta.pagination,
        })),
      );
  }

  override listLocations() {
    return this.api.get<ApiEnvelope<readonly InventoryLocation[]>>('/inventory/locations').pipe(
      map(({ data }) => data),
      catchError((error: unknown) => this.fallback(error, () => this.offline.listLocations())),
    );
  }

  override getProduct(productId: string) {
    return this.api
      .get<ApiEnvelope<InventoryProductDetails>>(`/products/${encodeURIComponent(productId)}`)
      .pipe(
        map(({ data }) => data),
        catchError((error: unknown) =>
          this.fallback(error, () => this.offline.getProduct(productId)),
        ),
      );
  }

  override createMovement(input: InventoryMovementInput) {
    return this.api
      .post<ApiEnvelope<InventoryMovement>, InventoryMovementInput>('/inventory/movements', input, {
        headers: this.idempotencyHeaders(),
      })
      .pipe(
        map(({ data }) => data),
        catchError((error: unknown) =>
          this.fallback(error, () => this.offline.createMovement(input)),
        ),
      );
  }

  override createStateTransition(input: InventoryStateTransitionInput) {
    return this.api
      .post<ApiEnvelope<InventoryMovement>, InventoryStateTransitionInput>(
        '/inventory/state-transitions',
        input,
        { headers: this.idempotencyHeaders() },
      )
      .pipe(map(({ data }) => data));
  }

  private queryParams(query: StockQuery | MovementQuery): Record<string, string | number> {
    const params: Record<string, string | number> = {
      page: query.page,
      pageSize: query.pageSize,
    };
    for (const [key, value] of Object.entries(query)) {
      if (key !== 'page' && key !== 'pageSize' && value) params[key] = value;
    }
    return params;
  }

  private idempotencyHeaders(): HttpHeaders {
    return new HttpHeaders({ 'Idempotency-Key': `web-${crypto.randomUUID()}` });
  }

  private fallback<T>(error: unknown, action: () => Promise<T>) {
    return isOfflineFailure(error) ? from(action()) : throwError(() => error);
  }
}

function isOfflineFailure(error: unknown): boolean {
  return error instanceof ApiError && ['network', 'timeout'].includes(error.kind);
}
