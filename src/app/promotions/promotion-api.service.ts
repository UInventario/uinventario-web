import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';
import type { PriceChannel } from '../pricing/price-list-api.service';

export type PromotionType =
  'BUY_X_GET_Y' | 'SECOND_UNIT_PERCENT' | 'BUNDLE_FIXED' | 'QUANTITY_PERCENT';

export interface PromotionData {
  id: string;
  name: string;
  type: PromotionType;
  scope: {
    branch: { id: string; name: string } | null;
    customer: { id: string; name: string } | null;
    channel: PriceChannel | null;
  };
  priority: number;
  stackable: boolean;
  validFrom: string;
  validTo: string | null;
  active: boolean;
  discountPercent: string | null;
  fixedPrice: string | null;
  buyQuantity: string | null;
  rewardQuantity: string | null;
  version: number;
  products: Array<{
    product: { id: string; name: string; sku: string };
    quantity: string;
  }>;
  tiers: Array<{ minimumQuantity: string; discountPercent: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionInput {
  name: string;
  type: PromotionType;
  branchId?: string;
  customerId?: string;
  channel?: PriceChannel;
  priority: number;
  stackable: boolean;
  validFrom: string;
  validTo?: string;
  active: boolean;
  discountPercent?: string;
  fixedPrice?: string;
  buyQuantity?: string;
  rewardQuantity?: string;
  products: Array<{ productId: string; quantity: string }>;
  tiers: Array<{ minimumQuantity: string; discountPercent: string }>;
}

@Injectable({ providedIn: 'root' })
export class PromotionApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  list() {
    return this.http.get<{ data: PromotionData[]; meta: { apiVersion: '1' } }>(
      `${this.config.apiBaseUrl()}/promotions`,
      { withCredentials: true },
    );
  }

  create(input: PromotionInput) {
    return this.http.post<{ data: PromotionData; meta: { apiVersion: '1' } }>(
      `${this.config.apiBaseUrl()}/promotions`,
      input,
      { withCredentials: true },
    );
  }

  update(id: string, input: PromotionInput & { version: number }) {
    return this.http.put<{ data: PromotionData; meta: { apiVersion: '1' } }>(
      `${this.config.apiBaseUrl()}/promotions/${id}`,
      input,
      { withCredentials: true },
    );
  }
}
