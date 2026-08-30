import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export type CommerceScope = 'CATALOG_READ' | 'STOCK_READ' | 'ORDERS_WRITE' | 'ORDERS_READ';
export type CommerceWebhookEvent =
  | 'ORDER_CONFIRMED'
  | 'ORDER_PREPARING'
  | 'ORDER_READY'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'ORDER_FULFILLMENT_UPDATED';

export interface CommerceCredentialData {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: CommerceScope[];
  context: {
    branch: { id: string; name: string };
    warehouse: { id: string; name: string };
    cashRegister: { id: string; name: string; code: string };
    location: { id: string; name: string; code: string };
    customer: { id: string; name: string };
  };
  active: boolean;
  rateLimitPerMinute: number;
  webhook: {
    url: string | null;
    events: CommerceWebhookEvent[];
    enabled: boolean;
    mode: 'SIMULATOR';
  };
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommerceWebhookDeliveryData {
  id: string;
  eventId: string;
  eventType: CommerceWebhookEvent;
  targetUrl: string;
  signature: string;
  status: 'PENDING' | 'SUCCEEDED' | 'RETRYABLE_FAILURE' | 'FAILED';
  attemptCount: number;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
  deliveredAt: string | null;
}

interface ApiResponse<T> {
  data: T;
  meta: { apiVersion: '1' };
}

export interface CreateCommerceCredentialInput {
  name: string;
  scopes: CommerceScope[];
  branchId: string;
  warehouseId: string;
  cashRegisterId: string;
  locationId: string;
  customerId: string;
  rateLimitPerMinute: number;
  webhookUrl?: string;
  webhookEvents: CommerceWebhookEvent[];
  webhookEnabled: boolean;
}

@Injectable({ providedIn: 'root' })
export class CommerceApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);
  private readonly baseUrl = `${this.config.apiBaseUrl()}/integrations/commerce`;

  credentials() {
    return this.http.get<ApiResponse<CommerceCredentialData[]>>(`${this.baseUrl}/credentials`, {
      withCredentials: true,
    });
  }

  create(input: CreateCommerceCredentialInput) {
    return this.http.post<
      ApiResponse<CommerceCredentialData & { apiKey: string }> & {
        meta: { apiVersion: '1'; warning: string };
      }
    >(`${this.baseUrl}/credentials`, input, { withCredentials: true });
  }

  revoke(id: string) {
    return this.http.delete<ApiResponse<{ revoked: true }>>(`${this.baseUrl}/credentials/${id}`, {
      withCredentials: true,
    });
  }

  deliveries() {
    return this.http.get<ApiResponse<CommerceWebhookDeliveryData[]>>(
      `${this.baseUrl}/webhook-deliveries`,
      { withCredentials: true },
    );
  }
}
