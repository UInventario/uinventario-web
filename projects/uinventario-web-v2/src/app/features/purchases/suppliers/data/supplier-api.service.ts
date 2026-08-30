import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../../../../core/api/api-client';
import { ApiEnvelope } from '../../../../core/api/api-contracts';
import { SupplierGateway } from '../domain/supplier.gateway';
import {
  CatalogProductOption,
  Pagination,
  Supplier,
  SupplierInput,
  SupplierProduct,
  SupplierProductInput,
  SupplierProductQuery,
  SupplierQuery,
} from '../domain/supplier.models';

interface ListResponse<T> {
  readonly data: readonly T[];
  readonly meta: { readonly pagination: Pagination };
}

interface ProductListItem {
  readonly id: string;
  readonly name: string;
  readonly sku: string;
  readonly cost: string;
  readonly price: string;
  readonly baseUnit: string;
  readonly quantityPrecision: number;
  readonly minimumQuantity: string;
}

@Injectable()
export class SupplierApi extends SupplierGateway {
  private readonly api = inject(ApiClient);

  override list(query: SupplierQuery) {
    const params: Record<string, string | number> = {
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    };
    if (query.q) params['q'] = query.q;
    return this.api
      .get<ListResponse<Supplier>>('/suppliers', { params })
      .pipe(map(({ data, meta }) => ({ suppliers: data, pagination: meta.pagination })));
  }

  override get(id: string) {
    return this.api
      .get<ApiEnvelope<Supplier>>(`/suppliers/${encodeURIComponent(id)}`)
      .pipe(map(({ data }) => data));
  }

  override create(input: SupplierInput) {
    return this.api
      .post<ApiEnvelope<Supplier>, SupplierInput>('/suppliers', input)
      .pipe(map(({ data }) => data));
  }

  override update(id: string, input: SupplierInput, version: number) {
    return this.api
      .patch<ApiEnvelope<Supplier>, SupplierInput & { readonly version: number }>(
        `/suppliers/${encodeURIComponent(id)}`,
        { ...input, version },
      )
      .pipe(map(({ data }) => data));
  }

  override deactivate(id: string) {
    return this.api
      .delete<ApiEnvelope<Supplier>>(`/suppliers/${encodeURIComponent(id)}`)
      .pipe(map(({ data }) => data));
  }

  override listProducts(query: SupplierProductQuery) {
    const params: Record<string, string | number> = {
      supplierId: query.supplierId,
      page: query.page,
      pageSize: query.pageSize,
    };
    if (query.q) params['q'] = query.q;
    return this.api
      .get<ListResponse<SupplierProduct>>('/supplier-products', { params })
      .pipe(map(({ data, meta }) => ({ products: data, pagination: meta.pagination })));
  }

  override getProduct(id: string) {
    return this.api
      .get<ApiEnvelope<SupplierProduct>>(`/supplier-products/${encodeURIComponent(id)}`)
      .pipe(map(({ data }) => data));
  }

  override createProduct(input: SupplierProductInput) {
    return this.api
      .post<ApiEnvelope<SupplierProduct>, SupplierProductInput>('/supplier-products', input)
      .pipe(map(({ data }) => data));
  }

  override updateProduct(id: string, input: SupplierProductInput, version: number) {
    return this.api
      .patch<ApiEnvelope<SupplierProduct>, SupplierProductInput & { readonly version: number }>(
        `/supplier-products/${encodeURIComponent(id)}`,
        { ...input, version },
      )
      .pipe(map(({ data }) => data));
  }

  override searchCatalogProducts(query: string) {
    return this.api
      .get<ListResponse<ProductListItem>>('/products', {
        params: { q: query, status: 'ACTIVE', page: 1, pageSize: 20 },
      })
      .pipe(
        map(({ data, meta }) => ({
          products: data.map((product): CatalogProductOption => ({
            id: product.id,
            name: product.name,
            sku: product.sku,
            catalogCost: product.cost,
            catalogPrice: product.price,
            baseUnit: product.baseUnit,
            quantityPrecision: product.quantityPrecision,
            minimumQuantity: product.minimumQuantity,
          })),
          pagination: meta.pagination,
        })),
      );
  }
}
