import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export interface ProductData {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  baseUnit?: ProductBaseUnit;
  quantityPrecision?: number;
  quantityRounding?: QuantityRoundingMode;
  minimumQuantity?: string;
  trackLots?: boolean;
  lotExpirationPolicy?: 'NONE' | 'OPTIONAL' | 'REQUIRED';
  lotExpirationAlertDays?: number;
  allowExpiredStockOverride?: boolean;
  trackSerials?: boolean;
  category: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
  cost: string;
  price: string;
  active: boolean;
  version: number;
  parentProductId?: string | null;
  variantAttributes?: Array<{ name: string; values: string[] }>;
  variantValues?: Array<{ attribute: string; value: string }>;
  sellable?: boolean;
  variants?: ProductData[];
  kit?: ProductKitData | null;
}

export interface ProductKitData {
  stockMode: 'DERIVED' | 'ASSEMBLED';
  priceRule: 'FIXED' | 'COMPONENT_SUM';
  effectiveFrom: string | null;
  effectiveTo: string | null;
  components: Array<{
    product: { id: string; name: string; sku: string };
    quantity: string;
  }>;
}

export interface ProductVariantInput {
  id?: string;
  version?: number;
  values: string[];
  sku: string;
  barcode?: string;
  cost: string;
  price: string;
  active: boolean;
}

export interface ProductInput {
  name: string;
  sku: string;
  barcode?: string;
  baseUnit: ProductBaseUnit;
  quantityPrecision: number;
  quantityRounding: QuantityRoundingMode;
  minimumQuantity: string;
  trackLots: boolean;
  lotExpirationPolicy?: 'NONE' | 'OPTIONAL' | 'REQUIRED';
  lotExpirationAlertDays?: number;
  allowExpiredStockOverride?: boolean;
  trackSerials?: boolean;
  categoryName?: string;
  brandName?: string;
  cost: string;
  price: string;
}

export type ProductBaseUnit =
  'UNIT' | 'KILOGRAM' | 'GRAM' | 'LITER' | 'MILLILITER' | 'METER' | 'CENTIMETER';
export type QuantityRoundingMode = 'HALF_UP' | 'DOWN' | 'UP';

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

export type ProductStatusFilter = 'ACTIVE' | 'INACTIVE' | 'ALL';
export type CatalogClassificationKind = 'categories' | 'brands';

export interface CatalogClassificationData {
  id: string;
  name: string;
  active: boolean;
  productCount: number;
}

export interface ProductRetirementResponse {
  data: {
    outcome: 'DELETED' | 'DEACTIVATED';
    product: ProductData | null;
  };
  meta: { apiVersion: '1' };
}

export interface ProductImportData {
  id: string;
  status: 'PREVIEWED' | 'CONFIRMED';
  policy: 'ATOMIC';
  templateVersion: string;
  sourceFilename: string;
  summary: { rows: number; creates: number; updates: number; unchanged: number; errors: number };
  canConfirm: boolean;
  rows: Array<{
    id: string;
    rowNumber: number;
    action: 'CREATE' | 'UPDATE' | 'UNCHANGED' | 'ERROR';
    name: string;
    sku: string;
    barcode: string | null;
    category: string | null;
    brand: string | null;
    cost: string | null;
    price: string | null;
    active: boolean;
    errors: Array<{ code: string; message: string }>;
  }>;
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

  list(query: {
    q?: string;
    status?: ProductStatusFilter;
    categoryId?: string;
    brandId?: string;
    sellableOnly?: boolean;
    page: number;
    pageSize: number;
  }) {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.q) params = params.set('q', query.q);
    if (query.status) params = params.set('status', query.status);
    if (query.categoryId) params = params.set('categoryId', query.categoryId);
    if (query.brandId) params = params.set('brandId', query.brandId);
    if (query.sellableOnly !== undefined) params = params.set('sellableOnly', query.sellableOnly);
    return this.http.get<ProductListResponse>(`${this.config.apiBaseUrl()}/products`, {
      params,
      withCredentials: true,
    });
  }

  updateVariants(
    id: string,
    input: {
      version: number;
      attributes: Array<{ name: string; values: string[] }>;
      variants: ProductVariantInput[];
    },
  ) {
    return this.http.put<ProductResponse>(
      `${this.config.apiBaseUrl()}/products/${id}/variants`,
      input,
      { withCredentials: true },
    );
  }

  updateKit(
    id: string,
    input: {
      version: number;
      enabled: boolean;
      stockMode?: ProductKitData['stockMode'];
      priceRule?: ProductKitData['priceRule'];
      effectiveFrom?: string;
      effectiveTo?: string;
      components?: Array<{ productId: string; quantity: string }>;
    },
  ) {
    return this.http.put<ProductResponse>(`${this.config.apiBaseUrl()}/products/${id}/kit`, input, {
      withCredentials: true,
    });
  }

  get(id: string) {
    return this.http.get<ProductResponse>(`${this.config.apiBaseUrl()}/products/${id}`, {
      withCredentials: true,
    });
  }

  resolveCode(code: string) {
    const params = new HttpParams().set('code', code);
    return this.http.get<ProductResponse>(`${this.config.apiBaseUrl()}/products/resolve-code`, {
      params,
      withCredentials: true,
    });
  }

  retire(id: string) {
    return this.http.delete<ProductRetirementResponse>(
      `${this.config.apiBaseUrl()}/products/${id}`,
      { withCredentials: true },
    );
  }

  previewImport(file: File) {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.http.post<{ data: ProductImportData }>(
      `${this.config.apiBaseUrl()}/products/imports/preview`,
      body,
      { withCredentials: true },
    );
  }

  confirmImport(id: string, idempotencyKey: string) {
    return this.http.post<{ data: ProductImportData }>(
      `${this.config.apiBaseUrl()}/products/imports/${id}/confirm`,
      {},
      { headers: { 'Idempotency-Key': idempotencyKey }, withCredentials: true },
    );
  }

  importResult(id: string) {
    return this.http.get(`${this.config.apiBaseUrl()}/products/imports/${id}/result`, {
      responseType: 'blob',
      withCredentials: true,
    });
  }

  listClassifications(kind: CatalogClassificationKind, includeInactive = false) {
    const params = new HttpParams().set('includeInactive', includeInactive);
    return this.http.get<{ data: CatalogClassificationData[] }>(
      `${this.config.apiBaseUrl()}/catalog/${kind}`,
      { params, withCredentials: true },
    );
  }

  createClassification(kind: CatalogClassificationKind, name: string) {
    return this.http.post<{ data: CatalogClassificationData }>(
      `${this.config.apiBaseUrl()}/catalog/${kind}`,
      { name },
      { withCredentials: true },
    );
  }

  updateClassification(
    kind: CatalogClassificationKind,
    id: string,
    input: { name?: string; active?: boolean },
  ) {
    return this.http.patch<{ data: CatalogClassificationData }>(
      `${this.config.apiBaseUrl()}/catalog/${kind}/${id}`,
      input,
      { withCredentials: true },
    );
  }

  deactivateClassification(kind: CatalogClassificationKind, id: string, replacementId?: string) {
    let params = new HttpParams();
    if (replacementId) params = params.set('replacementId', replacementId);
    return this.http.delete<{
      data: { classification: CatalogClassificationData; reassignedProducts: number };
    }>(`${this.config.apiBaseUrl()}/catalog/${kind}/${id}`, {
      params,
      withCredentials: true,
    });
  }
}
