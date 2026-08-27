import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export interface SupplierPriceData {
  id: string;
  currency: string;
  unitCost: string;
  validFrom: string;
  validTo: string | null;
  createdAt: string;
}

export interface SupplierProductData {
  id: string;
  supplier: { id: string; name: string };
  product: {
    id: string;
    name: string;
    sku: string;
    catalogCost: string;
    catalogPrice: string;
  };
  supplierCode: string;
  minimumQuantity: string | null;
  active: boolean;
  version: number;
  prices: SupplierPriceData[];
  createdAt: string;
  updatedAt: string;
}

export interface SupplierProductInput {
  supplierId: string;
  productId: string;
  supplierCode: string;
  currency: string;
  unitCost: string;
  minimumQuantity?: string;
  validFrom: string;
  validTo?: string;
}

interface SupplierProductResponse {
  data: SupplierProductData;
  meta: { apiVersion: '1' };
}

export interface SupplierProductListResponse {
  data: SupplierProductData[];
  meta: {
    apiVersion: '1';
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  };
}

@Injectable({ providedIn: 'root' })
export class SupplierProductApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  list(query: { q?: string; page: number; pageSize: number }) {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.q) params = params.set('q', query.q);
    return this.http.get<SupplierProductListResponse>(
      `${this.config.apiBaseUrl()}/supplier-products`,
      { params, withCredentials: true },
    );
  }

  create(input: SupplierProductInput) {
    return this.http.post<SupplierProductResponse>(
      `${this.config.apiBaseUrl()}/supplier-products`,
      input,
      { withCredentials: true },
    );
  }

  update(id: string, input: SupplierProductInput & { version: number }) {
    return this.http.patch<SupplierProductResponse>(
      `${this.config.apiBaseUrl()}/supplier-products/${id}`,
      input,
      { withCredentials: true },
    );
  }
}
