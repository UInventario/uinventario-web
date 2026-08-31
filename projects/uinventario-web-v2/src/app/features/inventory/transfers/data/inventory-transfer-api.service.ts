import { HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../../../../core/api/api-client';
import { ApiEnvelope } from '../../../../core/api/api-contracts';
import { InventoryTransferGateway } from '../domain/inventory-transfer.gateway';
import {
  CreateInventoryTransferInput,
  InventoryTransfer,
  ReceiveInventoryTransferInput,
  TransferBranch,
} from '../domain/inventory-transfer.models';

interface StockResponse {
  readonly data: readonly {
    readonly product: { readonly id: string; readonly name: string; readonly sku: string };
    readonly totalQuantity: string;
  }[];
}

@Injectable()
export class InventoryTransferApi extends InventoryTransferGateway {
  private readonly api = inject(ApiClient);

  override list() {
    return this.data(
      this.api.get<ApiEnvelope<readonly InventoryTransfer[]>>('/inventory/transfers'),
    );
  }

  override get(id: string) {
    return this.data(
      this.api.get<ApiEnvelope<InventoryTransfer>>(`/inventory/transfers/${this.id(id)}`),
    );
  }

  override branches() {
    return this.data(
      this.api.get<ApiEnvelope<readonly TransferBranch[]>>('/organization/branches'),
    );
  }

  override products(query?: string) {
    const params: Record<string, string | number> = { page: 1, pageSize: 100 };
    if (query) params['q'] = query;
    return this.api
      .get<StockResponse>('/inventory/stock', { params })
      .pipe(
        map(({ data }) =>
          data.map(({ product, totalQuantity }) => ({ ...product, quantity: totalQuantity })),
        ),
      );
  }

  override create(input: CreateInventoryTransferInput, key: string) {
    return this.data(
      this.api.post<ApiEnvelope<InventoryTransfer>, CreateInventoryTransferInput>(
        '/inventory/transfers',
        input,
        { headers: this.key(key) },
      ),
    );
  }

  override dispatch(id: string, key: string) {
    return this.data(
      this.api.post<ApiEnvelope<InventoryTransfer>, Record<string, never>>(
        `/inventory/transfers/${this.id(id)}/dispatch`,
        {},
        { headers: this.key(key) },
      ),
    );
  }

  override receive(id: string, input: ReceiveInventoryTransferInput, key: string) {
    return this.data(
      this.api.post<ApiEnvelope<InventoryTransfer>, ReceiveInventoryTransferInput>(
        `/inventory/transfers/${this.id(id)}/receipts`,
        input,
        { headers: this.key(key) },
      ),
    );
  }

  override cancel(id: string) {
    return this.data(
      this.api.post<ApiEnvelope<InventoryTransfer>, Record<string, never>>(
        `/inventory/transfers/${this.id(id)}/cancel`,
        {},
      ),
    );
  }

  private data<T>(request: import('rxjs').Observable<ApiEnvelope<T>>) {
    return request.pipe(map(({ data }) => data));
  }

  private key(value: string): HttpHeaders {
    return new HttpHeaders({ 'Idempotency-Key': value });
  }

  private id(value: string): string {
    return encodeURIComponent(value);
  }
}
