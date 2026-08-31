export type PriceChannel = 'POS' | 'WEB' | 'MOBILE' | 'DESKTOP';
export type PromotionType =
  'BUY_X_GET_Y' | 'SECOND_UNIT_PERCENT' | 'BUNDLE_FIXED' | 'QUANTITY_PERCENT';

export interface PricingScope {
  readonly branch: { readonly id: string; readonly name: string } | null;
  readonly customer: { readonly id: string; readonly name: string } | null;
  readonly channel: PriceChannel | null;
}

export interface PricingProduct {
  readonly id: string;
  readonly name: string;
  readonly sku: string;
  readonly price: string;
}

export interface PricingCustomer {
  readonly id: string;
  readonly name: string;
  readonly identifier: string | null;
  readonly email: string | null;
}

export interface PriceList {
  readonly id: string;
  readonly name: string;
  readonly currency: string;
  readonly scope: PricingScope;
  readonly priority: number;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly active: boolean;
  readonly version: number;
  readonly items: readonly {
    readonly id: string;
    readonly product: Pick<PricingProduct, 'id' | 'name' | 'sku'>;
    readonly price: string;
  }[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PriceListInput {
  readonly name: string;
  readonly currency: string;
  readonly branchId?: string;
  readonly customerId?: string;
  readonly channel?: PriceChannel;
  readonly priority: number;
  readonly validFrom: string;
  readonly validTo?: string;
  readonly active: boolean;
  readonly items: readonly { readonly productId: string; readonly price: string }[];
}

export interface Promotion {
  readonly id: string;
  readonly name: string;
  readonly type: PromotionType;
  readonly scope: PricingScope;
  readonly priority: number;
  readonly stackable: boolean;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly active: boolean;
  readonly discountPercent: string | null;
  readonly fixedPrice: string | null;
  readonly buyQuantity: string | null;
  readonly rewardQuantity: string | null;
  readonly version: number;
  readonly products: readonly {
    readonly product: Pick<PricingProduct, 'id' | 'name' | 'sku'>;
    readonly quantity: string;
  }[];
  readonly tiers: readonly { readonly minimumQuantity: string; readonly discountPercent: string }[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PromotionInput {
  readonly name: string;
  readonly type: PromotionType;
  readonly branchId?: string;
  readonly customerId?: string;
  readonly channel?: PriceChannel;
  readonly priority: number;
  readonly stackable: boolean;
  readonly validFrom: string;
  readonly validTo?: string;
  readonly active: boolean;
  readonly discountPercent?: string;
  readonly fixedPrice?: string;
  readonly buyQuantity?: string;
  readonly rewardQuantity?: string;
  readonly products: readonly { readonly productId: string; readonly quantity: string }[];
  readonly tiers: readonly { readonly minimumQuantity: string; readonly discountPercent: string }[];
}

export interface LoyaltyRule {
  readonly id: string;
  readonly version: number;
  readonly active: boolean;
  readonly earnAmount: string;
  readonly earnPoints: number;
  readonly redeemPoints: number;
  readonly redeemAmount: string;
  readonly expirationDays: number | null;
  readonly createdAt: string;
}

export interface LoyaltyRuleInput {
  readonly active: boolean;
  readonly earnAmount: string;
  readonly earnPoints: number;
  readonly redeemPoints: number;
  readonly redeemAmount: string;
  readonly expirationDays?: number;
}
