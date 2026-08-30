import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export type WhatsappTemplateKey =
  'WHATSAPP_SALE_RECEIPT' | 'WHATSAPP_ORDER_STATUS' | 'WHATSAPP_OPERATIONAL_NOTICE';
export type WhatsappMessageStatus =
  'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'REJECTED' | 'FAILED' | 'TIMED_OUT';

export interface WhatsappConsentData {
  customerId: string;
  customerName: string;
  phoneMasked: string | null;
  status: 'OPTED_IN' | 'OPTED_OUT';
  changedAt: string;
}

export interface WhatsappMessageData {
  id: string;
  customer: { id: string; name: string };
  template: { key: WhatsappTemplateKey; version: '1' };
  reference: string | null;
  recipientMasked: string;
  provider: 'SIMULATOR';
  providerReference: string | null;
  status: WhatsappMessageStatus;
  errorCode: string | null;
  lastEventAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Response<T, M = { apiVersion: '1' }> {
  data: T;
  meta: M;
}

@Injectable({ providedIn: 'root' })
export class WhatsappApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);
  private readonly baseUrl = `${this.config.apiBaseUrl()}/integrations/whatsapp/v1`;

  contract() {
    return this.http.get<
      Response<{ templates: WhatsappTemplateKey[]; guarantees: Record<string, boolean | number> }>
    >(`${this.baseUrl}/contract`, { withCredentials: true });
  }

  consents() {
    return this.http.get<Response<WhatsappConsentData[]>>(`${this.baseUrl}/consents`, {
      withCredentials: true,
    });
  }

  setConsent(customerId: string, enabled: boolean) {
    return this.http.put<Response<WhatsappConsentData>>(
      `${this.baseUrl}/customers/${customerId}/consent`,
      { enabled },
      { withCredentials: true },
    );
  }

  messages() {
    return this.http.get<Response<WhatsappMessageData[]>>(`${this.baseUrl}/messages`, {
      withCredentials: true,
    });
  }

  send(
    customerId: string,
    input: {
      templateKey: WhatsappTemplateKey;
      reference?: string;
      scenario: 'SUCCESS' | 'REJECT' | 'TIMEOUT' | 'RETRY';
    },
  ) {
    return this.http.post<
      Response<
        WhatsappMessageData,
        {
          apiVersion: '1';
          idempotentReplay: boolean;
          simulatorWebhookToken: string | null;
        }
      >
    >(`${this.baseUrl}/customers/${customerId}/messages`, input, {
      headers: new HttpHeaders({ 'Idempotency-Key': `web-whatsapp-${crypto.randomUUID()}` }),
      withCredentials: true,
    });
  }

  webhook(input: {
    token: string;
    providerEventId: string;
    providerReference: string;
    status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
    occurredAt: string;
  }) {
    const { token, ...body } = input;
    return this.http.post<
      Response<
        WhatsappMessageData,
        { apiVersion: '1'; idempotentReplay: boolean; ignoredOutOfOrder: boolean }
      >
    >(`${this.baseUrl}/webhooks/simulator`, body, {
      headers: new HttpHeaders({ 'x-simulator-webhook-token': token }),
      withCredentials: true,
    });
  }
}
