import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export interface ProductData {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
  cost: string;
  price: string;
  active: boolean;
  version: number;
}

export interface ProductInput {
  name: string;
  sku: string;
  barcode?: string;
  categoryName?: string;
  brandName?: string;
  cost: string;
  price: string;
}

export interface ProductResponse {
  data: ProductData;
  meta: { apiVersion: '1' };
}

export interface ProductListResponse {
  data: ProductData[];
  meta: {
    apiVersion: '1';
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  };
}

interface CatalogOptionsResponse {
  data: {
    categories: Array<{ id: string; name: string }>;
    brands: Array<{ id: string; name: string }>;
  };
  meta: { apiVersion: '1' };
}

@Injectable({ providedIn: 'root' })
export class ProductApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  getOptions() {
    return this.http.get<CatalogOptionsResponse>(`${this.config.apiBaseUrl()}/products/options`, {
      withCredentials: true,
    });
  }

  create(input: ProductInput) {
    return this.http.post<ProductResponse>(`${this.config.apiBaseUrl()}/products`, input, {
      withCredentials: true,
    });
  }

  update(id: string, input: ProductInput & { version: number }) {
    return this.http.patch<ProductResponse>(`${this.config.apiBaseUrl()}/products/${id}`, input, {
      withCredentials: true,
    });
  }

  list(query: { q?: string; page: number; pageSize: number }) {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.q) params = params.set('q', query.q);
    return this.http.get<ProductListResponse>(`${this.config.apiBaseUrl()}/products`, {
      params,
      withCredentials: true,
    });
  }

  get(id: string) {
    return this.http.get<ProductResponse>(`${this.config.apiBaseUrl()}/products/${id}`, {
      withCredentials: true,
    });
  }
}
