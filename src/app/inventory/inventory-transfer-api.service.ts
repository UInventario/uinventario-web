import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export type InventoryTransferStatus =
  'DRAFT' | 'DISPATCHED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface InventoryTransferLineData {
  id: string;
  lineNumber: number;
  product: { id: string; name: string; sku: string };
  sourceLocation: { id: string; name: string; code: string };
  destinationLocation: { id: string; name: string; code: string };
  quantity: string;
  receivedQuantity: string;
  discrepancyQuantity: string;
  pendingQuantity: string;
  serialNumbers?: string[];
}

export interface InventoryTransferReceiptData {
  id: string;
  discrepancyReason: string | null;
  receivedBy: { id: string; email: string };
  createdAt: string;
  lines: Array<{
    id: string;
    lineNumber: number;
    transferLineId: string;
    product: { id: string; name: string; sku: string };
    receivedQuantity: string;
    discrepancyQuantity: string;
  }>;
}

export interface InventoryTransferData {
  id: string;
  status: InventoryTransferStatus;
  reference: string;
  reason: string;
  originWarehouse: {
    id: string;
    name: string;
    branch: { id: string; name: string };
  };
  destinationWarehouse: {
    id: string;
    name: string;
    branch: { id: string; name: string };
  };
  lines: InventoryTransferLineData[];
  receipts: InventoryTransferReceiptData[];
  createdBy: { id: string; email: string };
  dispatchedBy: { id: string; email: string } | null;
  cancelledBy: { id: string; email: string } | null;
  createdAt: string;
  dispatchedAt: string | null;
  cancelledAt: string | null;
}

export interface InventoryTransferInput {
  destinationWarehouseId: string;
  reference: string;
  reason: string;
  lines: Array<{
    productId: string;
    sourceLocationId: string;
    destinationLocationId: string;
    quantity: string;
    serialNumbers?: string[];
  }>;
}

export interface InventoryTransferReceiptInput {
  discrepancyReason?: string;
  lines: Array<{
    transferLineId: string;
    receivedQuantity: string;
    discrepancyQuantity: string;
    receivedSerialNumbers?: string[];
    discrepancySerialNumbers?: string[];
  }>;
}

interface InventoryTransferResponse {
  data: InventoryTransferData;
  meta: { apiVersion: '1'; idempotentReplay?: boolean };
}

interface InventoryTransferListResponse {
  data: InventoryTransferData[];
  meta: { apiVersion: '1' };
}

@Injectable({ providedIn: 'root' })
export class InventoryTransferApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  list() {
    return this.http.get<InventoryTransferListResponse>(
      `${this.config.apiBaseUrl()}/inventory/transfers`,
      { withCredentials: true },
    );
  }

  create(input: InventoryTransferInput, idempotencyKey: string) {
    const headers = new HttpHeaders().set('Idempotency-Key', idempotencyKey);
    return this.http.post<InventoryTransferResponse>(
      `${this.config.apiBaseUrl()}/inventory/transfers`,
      input,
      { headers, withCredentials: true },
    );
  }

  dispatch(id: string, idempotencyKey: string) {
    const headers = new HttpHeaders().set('Idempotency-Key', idempotencyKey);
    return this.http.post<InventoryTransferResponse>(
      `${this.config.apiBaseUrl()}/inventory/transfers/${id}/dispatch`,
      {},
      { headers, withCredentials: true },
    );
  }

  cancel(id: string) {
    return this.http.post<InventoryTransferResponse>(
      `${this.config.apiBaseUrl()}/inventory/transfers/${id}/cancel`,
      {},
      { withCredentials: true },
    );
  }

  receive(id: string, input: InventoryTransferReceiptInput, idempotencyKey: string) {
    const headers = new HttpHeaders().set('Idempotency-Key', idempotencyKey);
    return this.http.post<InventoryTransferResponse>(
      `${this.config.apiBaseUrl()}/inventory/transfers/${id}/receipts`,
      input,
      { headers, withCredentials: true },
    );
  }
}
