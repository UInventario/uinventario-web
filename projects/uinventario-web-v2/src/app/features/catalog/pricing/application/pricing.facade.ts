import { Injectable, inject } from '@angular/core';
import { PricingGateway } from '../domain/pricing.gateway';
import {
  LoyaltyRuleInput,
  PriceList,
  PriceListInput,
  Promotion,
  PromotionInput,
} from '../domain/pricing.models';

@Injectable()
export class PricingFacade {
  private readonly gateway = inject(PricingGateway);

  listPriceLists() {
    return this.gateway.listPriceLists();
  }
  listPromotions() {
    return this.gateway.listPromotions();
  }
  currentLoyaltyRule() {
    return this.gateway.currentLoyaltyRule();
  }
  searchProducts(query = '') {
    return this.gateway.searchProducts(query.trim());
  }
  searchCustomers(query: string) {
    return this.gateway.searchCustomers(query.trim());
  }

  savePriceList(input: PriceListInput, current?: PriceList) {
    return this.gateway.savePriceList(this.cleanPriceList(input), current);
  }

  savePromotion(input: PromotionInput, current?: Promotion) {
    return this.gateway.savePromotion(this.cleanPromotion(input), current);
  }

  saveLoyaltyRule(input: LoyaltyRuleInput) {
    return this.gateway.saveLoyaltyRule({
      ...input,
      earnAmount: input.earnAmount.trim(),
      redeemAmount: input.redeemAmount.trim(),
    });
  }

  private cleanPriceList(input: PriceListInput): PriceListInput {
    return {
      ...input,
      name: input.name.trim(),
      currency: input.currency.trim().toUpperCase(),
      items: input.items.map((item) => ({ ...item, price: item.price.trim() })),
    };
  }

  private cleanPromotion(input: PromotionInput): PromotionInput {
    return {
      ...input,
      name: input.name.trim(),
      products: input.products.map((item) => ({ ...item, quantity: item.quantity.trim() })),
      tiers: input.tiers.map((tier) => ({
        minimumQuantity: tier.minimumQuantity.trim(),
        discountPercent: tier.discountPercent.trim(),
      })),
    };
  }
}
