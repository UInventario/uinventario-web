import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';
import type { CollectedPaymentMethod } from '../pos/pos-api.service';

export type CustomerOrderStatus =
  'DRAFT' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
export type CustomerOrderPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface CustomerOrderData {
  id: string;
  orderNumber: string;
  channel: 'POS' | 'WEB' | 'MOBILE' | 'DESKTOP';
  priority: CustomerOrderPriority;
  status: CustomerOrderStatus;
  version: number;
  customer: { id: string; name: string; identifier: string | null };
  context: {
    branch: { id: string; name: string };
    warehouse: { id: string; name: string };
    cashRegister: { id: string; name: string; code: string };
    location: { id: string; name: string; code: string };
  };
  currency: string;
  totals: { subtotal: string; tax: string; total: string };
  expiresInHours: number;
  reservation: { id: string; reservationNumber: string; status: string } | null;
  sale: { id: string; receiptNumber: string } | null;
  lines: Array<{
    id: string;
    product: { id: string; name: string; sku: string };
    quantity: string;
    serialNumbers: string[];
    total: string;
  }>;
  payments: Array<{
    id: string;
    method: CollectedPaymentMethod;
    amount: string;
    amountReceived: string;
    reference: string | null;
    status: 'PLANNED' | 'COMPLETED' | 'CANCELLED';
  }>;
  transitions: Array<{
    id: string;
    fromStatus: CustomerOrderStatus;
    toStatus: CustomerOrderStatus;
    reason: string | null;
    actor: { id: string; email: string };
    createdAt: string;
  }>;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerOrderInput {
  channel: CustomerOrderData['channel'];
  customerId: string;
  locationId: string;
  priority: CustomerOrderPriority;
  expiresInHours: number;
  lines: Array<{ productId: string; quantity: string; serialNumbers?: string[] }>;
  payments: Array<{
    method: CollectedPaymentMethod;
    amountReceived?: string;
    reference?: string;
  }>;
}

interface CustomerOrderResponse {
  data: CustomerOrderData;
  meta: { apiVersion: '1'; idempotentReplay: boolean };
}

@Injectable({ providedIn: 'root' })
export class CustomerOrderApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  list(query: {
    status?: CustomerOrderStatus;
    priority?: CustomerOrderPriority;
    page?: number;
    pageSize?: number;
  }) {
    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('pageSize', String(query.pageSize ?? 20));
    if (query.status) params = params.set('status', query.status);
    if (query.priority) params = params.set('priority', query.priority);
    return this.http.get<{
      data: CustomerOrderData[];
      meta: {
        apiVersion: '1';
        pagination: { page: number; pageSize: number; total: number; totalPages: number };
      };
    }>(`${this.config.apiBaseUrl()}/orders`, { params, withCredentials: true });
  }

  create(input: CustomerOrderInput, key: string) {
    return this.http.post<CustomerOrderResponse>(`${this.config.apiBaseUrl()}/orders`, input, {
      withCredentials: true,
      headers: new HttpHeaders({ 'Idempotency-Key': key }),
    });
  }

  transition(
    id: string,
    action: 'confirm' | 'prepare' | 'ready' | 'deliver' | 'cancel',
    version: number,
    key: string,
    reason?: string,
  ) {
    return this.http.post<CustomerOrderResponse>(
      `${this.config.apiBaseUrl()}/orders/${id}/${action}`,
      { version, ...(reason ? { reason } : {}) },
      {
        withCredentials: true,
        headers: new HttpHeaders({ 'Idempotency-Key': key }),
      },
    );
  }
}
