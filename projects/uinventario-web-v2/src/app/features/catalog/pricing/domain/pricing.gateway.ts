import { Observable } from 'rxjs';
import {
  LoyaltyRule,
  LoyaltyRuleInput,
  PriceList,
  PriceListInput,
  PricingCustomer,
  PricingProduct,
  Promotion,
  PromotionInput,
} from './pricing.models';

export abstract class PricingGateway {
  abstract listPriceLists(): Observable<readonly PriceList[]>;
  abstract savePriceList(input: PriceListInput, current?: PriceList): Observable<PriceList>;
  abstract listPromotions(): Observable<readonly Promotion[]>;
  abstract savePromotion(input: PromotionInput, current?: Promotion): Observable<Promotion>;
  abstract currentLoyaltyRule(): Observable<LoyaltyRule | null>;
  abstract saveLoyaltyRule(input: LoyaltyRuleInput): Observable<LoyaltyRule>;
  abstract searchProducts(query: string): Observable<readonly PricingProduct[]>;
  abstract searchCustomers(query: string): Observable<readonly PricingCustomer[]>;
}
