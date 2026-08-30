import { HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../../../../core/api/api-client';
import { ApiEnvelope } from '../../../../core/api/api-contracts';
import { ProcurementGateway } from '../domain/procurement.gateway';
import {
  Pagination,
  PurchaseOrder,
  PurchaseOrderInput,
  PurchaseOrderQuery,
  PurchaseReceiptInput,
  PurchaseReturnInput,
  ReceiptLocation,
  SupplierOption,
  SupplierProductOption,
} from '../domain/procurement.models';

interface ListResponse<T> {
  readonly data: readonly T[];
  readonly meta: { readonly pagination: Pagination };
}

@Injectable()
export class ProcurementApi extends ProcurementGateway {
  private readonly api = inject(ApiClient);

  override list(query: PurchaseOrderQuery) {
    const params: Record<string, string | number> = {
      page: query.page,
      pageSize: query.pageSize,
    };
    if (query.q) params['q'] = query.q;
    return this.api
      .get<ListResponse<PurchaseOrder>>('/purchase-orders', { params })
      .pipe(map(({ data, meta }) => ({ orders: data, pagination: meta.pagination })));
  }

  override get(id: string) {
    return this.data(
      this.api.get<ApiEnvelope<PurchaseOrder>>(`/purchase-orders/${encodeURIComponent(id)}`),
    );
  }

  override create(input: PurchaseOrderInput) {
    return this.data(
      this.api.post<ApiEnvelope<PurchaseOrder>, PurchaseOrderInput>('/purchase-orders', input),
    );
  }

  override update(id: string, input: PurchaseOrderInput, version: number) {
    return this.data(
      this.api.patch<ApiEnvelope<PurchaseOrder>, PurchaseOrderInput & { readonly version: number }>(
        `/purchase-orders/${encodeURIComponent(id)}`,
        { ...input, version },
      ),
    );
  }

  override approve(id: string, version: number, idempotencyKey: string, reason?: string) {
    return this.transition(id, 'approve', { version, reason }, idempotencyKey);
  }

  override send(id: string, version: number, idempotencyKey: string) {
    return this.transition(id, 'send', { version }, idempotencyKey);
  }

  override cancel(id: string, version: number, reason: string, idempotencyKey: string) {
    return this.transition(id, 'cancel', { version, reason }, idempotencyKey);
  }

  override receive(id: string, input: PurchaseReceiptInput, idempotencyKey: string) {
    return this.data(
      this.api.post<ApiEnvelope<PurchaseOrder>, PurchaseReceiptInput>(
        `/purchase-orders/${encodeURIComponent(id)}/receipts`,
        input,
        { headers: this.idempotencyHeaders(idempotencyKey) },
      ),
    );
  }

  override returnToSupplier(id: string, input: PurchaseReturnInput, idempotencyKey: string) {
    return this.data(
      this.api.post<ApiEnvelope<PurchaseOrder>, PurchaseReturnInput>(
        `/purchase-orders/${encodeURIComponent(id)}/returns`,
        input,
        { headers: this.idempotencyHeaders(idempotencyKey) },
      ),
    );
  }

  override listSuppliers() {
    return this.api
      .get<ListResponse<SupplierOption>>('/suppliers', {
        params: { status: 'ACTIVE', page: 1, pageSize: 100 },
      })
      .pipe(map(({ data }) => data));
  }

  override listSupplierProducts(supplierId: string) {
    return this.api
      .get<ListResponse<SupplierProductOption>>('/supplier-products', {
        params: { supplierId, page: 1, pageSize: 100 },
      })
      .pipe(map(({ data }) => data));
  }

  override listLocations() {
    return this.data(this.api.get<ApiEnvelope<readonly ReceiptLocation[]>>('/inventory/locations'));
  }

  private transition(
    id: string,
    action: 'approve' | 'send' | 'cancel',
    body: { readonly version: number; readonly reason?: string },
    idempotencyKey: string,
  ) {
    return this.data(
      this.api.post<ApiEnvelope<PurchaseOrder>, typeof body>(
        `/purchase-orders/${encodeURIComponent(id)}/${action}`,
        body,
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
