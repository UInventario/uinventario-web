import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../../../../core/api/api-client';
import { ApiEnvelope } from '../../../../core/api/api-contracts';
import { PricingGateway } from '../domain/pricing.gateway';
import {
  LoyaltyRule,
  LoyaltyRuleInput,
  PriceList,
  PriceListInput,
  PricingCustomer,
  PricingProduct,
  Promotion,
  PromotionInput,
} from '../domain/pricing.models';

@Injectable()
export class PricingApi extends PricingGateway {
  private readonly api = inject(ApiClient);

  override listPriceLists() {
    return this.api
      .get<ApiEnvelope<readonly PriceList[]>>('/price-lists')
      .pipe(map(({ data }) => data));
  }

  override savePriceList(input: PriceListInput, current?: PriceList) {
    return current
      ? this.api
          .put<ApiEnvelope<PriceList>, PriceListInput & { readonly version: number }>(
            `/price-lists/${encodeURIComponent(current.id)}`,
            { ...input, version: current.version },
          )
          .pipe(map(({ data }) => data))
      : this.api
          .post<ApiEnvelope<PriceList>, PriceListInput>('/price-lists', input)
          .pipe(map(({ data }) => data));
  }

  override listPromotions() {
    return this.api
      .get<ApiEnvelope<readonly Promotion[]>>('/promotions')
      .pipe(map(({ data }) => data));
  }

  override savePromotion(input: PromotionInput, current?: Promotion) {
    return current
      ? this.api
          .put<ApiEnvelope<Promotion>, PromotionInput & { readonly version: number }>(
            `/promotions/${encodeURIComponent(current.id)}`,
            { ...input, version: current.version },
          )
          .pipe(map(({ data }) => data))
      : this.api
          .post<ApiEnvelope<Promotion>, PromotionInput>('/promotions', input)
          .pipe(map(({ data }) => data));
  }

  override currentLoyaltyRule() {
    return this.api
      .get<ApiEnvelope<LoyaltyRule | null>>('/loyalty/rules/current')
      .pipe(map(({ data }) => data));
  }

  override saveLoyaltyRule(input: LoyaltyRuleInput) {
    return this.api
      .put<ApiEnvelope<LoyaltyRule>, LoyaltyRuleInput>('/loyalty/rules/current', input)
      .pipe(map(({ data }) => data));
  }

  override searchProducts(query: string) {
    return this.api
      .get<{ readonly data: readonly PricingProduct[] }>('/products', {
        params: { q: query, status: 'ACTIVE', sellableOnly: true, page: 1, pageSize: 50 },
      })
      .pipe(map(({ data }) => data));
  }

  override searchCustomers(query: string) {
    return this.api
      .get<{ readonly data: readonly PricingCustomer[] }>('/customers', {
        params: { q: query, status: 'ACTIVE', page: 1, pageSize: 20 },
      })
      .pipe(map(({ data }) => data));
  }
}
