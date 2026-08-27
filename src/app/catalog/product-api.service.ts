import { HttpClient } from '@angular/common/http';
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

interface ProductResponse {
  data: ProductData;
  meta: { apiVersion: '1' };
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
    return this.http.get<CatalogOptionsResponse>(
      `${this.config.apiBaseUrl()}/products/options`,
      { withCredentials: true },
    );
  }

  create(input: ProductInput) {
    return this.http.post<ProductResponse>(`${this.config.apiBaseUrl()}/products`, input, {
      withCredentials: true,
    });
  }
}
