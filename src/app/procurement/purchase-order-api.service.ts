import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export type PurchaseOrderStatus =
  'DRAFT' | 'APPROVED' | 'SENT' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderLineData {
  id: string;
  supplierProductId: string;
  productId: string;
  productName: string;
  productSku: string;
  supplierCode: string;
  quantity: string;
  receivedQuantity: string;
  remainingQuantity: string;
  overageQuantity: string;
  unitCost: string;
  subtotal: string;
  notes: string | null;
}

export interface PurchaseOrderData {
  id: string;
  folio: string;
  supplier: { id: string; name: string };
  currency: string;
  status: PurchaseOrderStatus;
  notes: string | null;
  subtotal: string;
  total: string;
  version: number;
  approvedAt: string | null;
  sentAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  transitions: PurchaseOrderTransitionData[];
  receipts: PurchaseReceiptData[];
  returns: PurchaseReturnData[];
  lines: PurchaseOrderLineData[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseReceiptData {
  id: string;
  documentReference: string;
  location: { id: string; name: string; code: string };
  responsible: { id: string; email: string };
  overageReason: string | null;
  lines: Array<{
    id: string;
    purchaseOrderLineId: string;
    receivedQuantity: string;
    overageQuantity: string;
    unitCost: string;
    totalCost: string;
    previousCatalogCost: string;
    resultingCatalogCost: string;
    returnedQuantity: string;
    returnableQuantity: string;
  }>;
  createdAt: string;
}

export interface PurchaseReturnData {
  id: string;
  purchaseReceiptId: string;
  documentReference: string;
  reason: string;
  status: 'CREDIT_PENDING' | 'CREDIT_RECEIVED';
  expectedCreditTotal: string;
  creditDocumentReference: string | null;
  location: { id: string; name: string; code: string };
  responsible: { id: string; email: string };
  lines: Array<{
    id: string;
    purchaseReceiptLineId: string;
    productId: string;
    returnedQuantity: string;
    unitCost: string;
    totalCost: string;
  }>;
  createdAt: string;
}

export interface PurchaseReceiptInput {
  version: number;
  locationId: string;
  documentReference: string;
  overageReason?: string;
  lines: Array<{ purchaseOrderLineId: string; receivedQuantity: string }>;
}

export interface PurchaseReturnInput {
  purchaseReceiptId: string;
  documentReference: string;
  reason: string;
  lines: Array<{ purchaseReceiptLineId: string; returnedQuantity: string }>;
}

export interface PurchaseOrderTransitionData {
  id: string;
  fromStatus: PurchaseOrderStatus;
  toStatus: PurchaseOrderStatus;
  reason: string | null;
  delivery: { mode: 'SIMULATED'; recipient: string | null } | null;
  createdAt: string;
}

export interface PurchaseOrderInput {
  supplierId: string;
  currency: string;
  notes?: string;
  lines: Array<{
    supplierProductId: string;
    quantity: string;
    unitCost: string;
    notes?: string;
  }>;
}

interface PurchaseOrderResponse {
  data: PurchaseOrderData;
  meta: { apiVersion: '1' };
}

export interface PurchaseOrderListResponse {
  data: PurchaseOrderData[];
  meta: {
    apiVersion: '1';
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  };
}

@Injectable({ providedIn: 'root' })
export class PurchaseOrderApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  list(query: { q?: string; page: number; pageSize: number }) {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.q) params = params.set('q', query.q);
    return this.http.get<PurchaseOrderListResponse>(`${this.config.apiBaseUrl()}/purchase-orders`, {
      params,
      withCredentials: true,
    });
  }

  create(input: PurchaseOrderInput) {
    return this.http.post<PurchaseOrderResponse>(
      `${this.config.apiBaseUrl()}/purchase-orders`,
      input,
      { withCredentials: true },
    );
  }

  update(id: string, input: PurchaseOrderInput & { version: number }) {
    return this.http.patch<PurchaseOrderResponse>(
      `${this.config.apiBaseUrl()}/purchase-orders/${id}`,
      input,
      { withCredentials: true },
    );
  }

  approve(id: string, input: { version: number; reason?: string }, idempotencyKey: string) {
    return this.transition(id, 'approve', input, idempotencyKey);
  }

  send(id: string, version: number, idempotencyKey: string) {
    return this.transition(id, 'send', { version }, idempotencyKey);
  }

  cancel(id: string, input: { version: number; reason: string }, idempotencyKey: string) {
    return this.transition(id, 'cancel', input, idempotencyKey);
  }

  receive(id: string, input: PurchaseReceiptInput, idempotencyKey: string) {
    return this.http.post<PurchaseOrderResponse>(
      `${this.config.apiBaseUrl()}/purchase-orders/${id}/receipts`,
      input,
      {
        headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
        withCredentials: true,
      },
    );
  }

  returnToSupplier(id: string, input: PurchaseReturnInput, idempotencyKey: string) {
    return this.http.post<PurchaseOrderResponse>(
      `${this.config.apiBaseUrl()}/purchase-orders/${id}/returns`,
      input,
      {
        headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
        withCredentials: true,
      },
    );
  }

  private transition(
    id: string,
    action: 'approve' | 'send' | 'cancel',
    body: { version: number; reason?: string },
    idempotencyKey: string,
  ) {
    return this.http.post<PurchaseOrderResponse>(
      `${this.config.apiBaseUrl()}/purchase-orders/${id}/${action}`,
      body,
      {
        headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
        withCredentials: true,
      },
    );
  }
}
