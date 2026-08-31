import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../../../core/api/api-client';
import { ApiEnvelope } from '../../../core/api/api-contracts';
import { API_BASE_URL } from '../../../core/api/api-runtime-config';
import { CatalogGateway } from '../domain/catalog.gateway';
import {
  CatalogOptions,
  Classification,
  ClassificationKind,
  Product,
  ProductImport,
  ProductInput,
  ProductPage,
  ProductQuery,
  UpdateProductKitInput,
  UpdateProductVariantsInput,
} from '../domain/catalog.models';

interface ProductListResponse {
  readonly data: readonly Product[];
  readonly meta: { readonly apiVersion: '1'; readonly pagination: ProductPage['pagination'] };
}

@Injectable()
export class CatalogApi extends CatalogGateway {
  private readonly api = inject(ApiClient);
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  override listProducts(query: ProductQuery) {
    const params: Record<string, string | number> = {
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    };
    if (query.q) params['q'] = query.q;
    if (query.categoryId) params['categoryId'] = query.categoryId;
    if (query.brandId) params['brandId'] = query.brandId;
    return this.api
      .get<ProductListResponse>('/products', { params })
      .pipe(map(({ data, meta }) => ({ products: data, pagination: meta.pagination })));
  }

  override getOptions() {
    return this.api
      .get<ApiEnvelope<CatalogOptions>>('/products/options')
      .pipe(map(({ data }) => data));
  }

  override getProduct(id: string) {
    return this.api
      .get<ApiEnvelope<Product>>(`/products/${encodeURIComponent(id)}`)
      .pipe(map(({ data }) => data));
  }

  override createProduct(input: ProductInput) {
    return this.api
      .post<ApiEnvelope<Product>, ProductInput>('/products', input)
      .pipe(map(({ data }) => data));
  }

  override updateProduct(id: string, input: ProductInput, version: number) {
    return this.api
      .patch<ApiEnvelope<Product>, ProductInput & { readonly version: number }>(
        `/products/${encodeURIComponent(id)}`,
        { ...input, version },
      )
      .pipe(map(({ data }) => data));
  }

  override updateProductVariants(id: string, input: UpdateProductVariantsInput) {
    return this.api
      .put<ApiEnvelope<Product>, UpdateProductVariantsInput>(
        `/products/${encodeURIComponent(id)}/variants`,
        input,
      )
      .pipe(map(({ data }) => data));
  }

  override updateProductKit(id: string, input: UpdateProductKitInput) {
    return this.api
      .put<ApiEnvelope<Product>, UpdateProductKitInput>(
        `/products/${encodeURIComponent(id)}/kit`,
        input,
      )
      .pipe(map(({ data }) => data));
  }

  override retireProduct(id: string) {
    return this.api
      .delete<ApiEnvelope<{ readonly outcome: 'DELETED' | 'DEACTIVATED' }>>(
        `/products/${encodeURIComponent(id)}`,
      )
      .pipe(map(({ data }) => data.outcome));
  }

  override listClassifications(kind: ClassificationKind, includeInactive: boolean) {
    return this.api
      .get<ApiEnvelope<readonly Classification[]>>(`/catalog/${kind}`, {
        params: { includeInactive },
      })
      .pipe(map(({ data }) => data));
  }

  override createClassification(kind: ClassificationKind, name: string) {
    return this.api
      .post<ApiEnvelope<Classification>, { readonly name: string }>(`/catalog/${kind}`, { name })
      .pipe(map(({ data }) => data));
  }

  override updateClassification(
    kind: ClassificationKind,
    id: string,
    input: { readonly name?: string; readonly active?: boolean },
  ) {
    return this.api
      .patch<ApiEnvelope<Classification>, typeof input>(
        `/catalog/${kind}/${encodeURIComponent(id)}`,
        input,
      )
      .pipe(map(({ data }) => data));
  }

  override retireClassification(kind: ClassificationKind, id: string, replacementId?: string) {
    const params = replacementId ? new HttpParams().set('replacementId', replacementId) : undefined;
    return this.api
      .delete<ApiEnvelope<{ readonly reassignedProducts: number }>>(
        `/catalog/${kind}/${encodeURIComponent(id)}`,
        { params },
      )
      .pipe(map(({ data }) => data.reassignedProducts));
  }

  override previewImport(file: File) {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.api
      .post<ApiEnvelope<ProductImport>, FormData>('/products/imports/preview', body)
      .pipe(map(({ data }) => data));
  }

  override confirmImport(id: string, idempotencyKey: string) {
    return this.api
      .post<ApiEnvelope<ProductImport>, Record<string, never>>(
        `/products/imports/${encodeURIComponent(id)}/confirm`,
        {},
        { headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }) },
      )
      .pipe(map(({ data }) => data));
  }

  override downloadImportResult(id: string) {
    return this.http.get(`${this.apiBaseUrl}/products/imports/${encodeURIComponent(id)}/result`, {
      responseType: 'blob',
    });
  }
}
