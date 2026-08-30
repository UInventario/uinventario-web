import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../../../../core/api/api-client';
import { ApiEnvelope } from '../../../../core/api/api-contracts';
import { PosGateway } from '../domain/pos.gateway';
import {
  CashRegisterShift,
  PosCartQuote,
  PosCartRequest,
  PosProduct,
  PosProductPage,
} from '../domain/pos.models';

interface ProductResponse {
  readonly data: readonly PosProduct[];
  readonly meta: { readonly pagination: PosProductPage['pagination'] };
}

@Injectable()
export class PosApi extends PosGateway {
  private readonly api = inject(ApiClient);

  override searchProducts(query: string) {
    return this.api
      .get<ProductResponse>('/products', {
        params: {
          q: query,
          status: 'ACTIVE',
          sellableOnly: true,
          page: 1,
          pageSize: 24,
        },
      })
      .pipe(map(({ data, meta }) => ({ products: data, pagination: meta.pagination })));
  }

  override resolveCode(code: string) {
    return this.api
      .get<ApiEnvelope<PosProduct>>('/products/resolve-code', { params: { code } })
      .pipe(map(({ data }) => data));
  }

  override currentShift() {
    return this.api
      .get<ApiEnvelope<CashRegisterShift | null>>('/pos/register-shifts/current')
      .pipe(map(({ data }) => data));
  }

  override quoteCart(input: PosCartRequest) {
    return this.api
      .post<ApiEnvelope<PosCartQuote>, PosCartRequest>('/pos/cart/quote', input)
      .pipe(map(({ data }) => data));
  }
}
