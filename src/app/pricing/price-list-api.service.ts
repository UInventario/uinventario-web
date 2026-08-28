import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export type PriceChannel = 'POS' | 'WEB' | 'MOBILE' | 'DESKTOP';

export interface PriceListData {
  id: string;
  name: string;
  currency: string;
  scope: {
    branch: { id: string; name: string } | null;
    customer: { id: string; name: string } | null;
    channel: PriceChannel | null;
  };
  priority: number;
  validFrom: string;
  validTo: string | null;
  active: boolean;
  version: number;
  items: Array<{
    id: string;
    product: { id: string; name: string; sku: string };
    price: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface PriceListInput {
  name: string;
  currency: string;
  branchId?: string;
  customerId?: string;
  channel?: PriceChannel;
  priority: number;
  validFrom: string;
  validTo?: string;
  active: boolean;
  items: Array<{ productId: string; price: string }>;
}

@Injectable({ providedIn: 'root' })
export class PriceListApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  list() {
    return this.http.get<{ data: PriceListData[]; meta: { apiVersion: '1' } }>(
      `${this.config.apiBaseUrl()}/price-lists`,
      { withCredentials: true },
    );
  }

  create(input: PriceListInput) {
    return this.http.post<{ data: PriceListData; meta: { apiVersion: '1' } }>(
      `${this.config.apiBaseUrl()}/price-lists`,
      input,
      { withCredentials: true },
    );
  }

  update(id: string, input: PriceListInput & { version: number }) {
    return this.http.put<{ data: PriceListData; meta: { apiVersion: '1' } }>(
      `${this.config.apiBaseUrl()}/price-lists/${id}`,
      input,
      { withCredentials: true },
    );
  }
}
