import { HttpClient, HttpParams } from '@angular/common/http';
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
  lines: PurchaseOrderLineData[];
  createdAt: string;
  updatedAt: string;
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
}
