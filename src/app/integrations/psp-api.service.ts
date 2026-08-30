import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export type PspStatus =
  | 'REQUIRES_CONFIRMATION'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'INDETERMINATE'
  | 'DECLINED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';

export interface PspPaymentData {
  id: string;
  provider: 'SIMULATOR';
  adapterVersion: '1';
  providerReference: string;
  merchantReference: string;
  amount: string;
  refundedAmount: string;
  currency: string;
  status: PspStatus;
  scenario: 'SUCCESS' | 'DECLINE' | 'TIMEOUT';
  errorCode: string | null;
  correlationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PspContractData {
  name: 'UINVENTARIO_PSP';
  version: '1';
  activeProvider: {
    key: 'SIMULATOR';
    mode: 'SIMULATOR';
    production: false;
    requiresCardData: false;
  };
  liveProviderProfile: {
    key: 'STRIPE_COMPATIBLE';
    runtimeAvailable: false;
    secretReferences: string[];
  };
  operations: string[];
  guarantees: Record<string, boolean>;
}

@Injectable({ providedIn: 'root' })
export class PspApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);
  private readonly baseUrl = `${this.config.apiBaseUrl()}/integrations/psp/v1`;

  contract() {
    return this.http.get<{ data: PspContractData; meta: { apiVersion: '1' } }>(
      `${this.baseUrl}/contract`,
      { withCredentials: true },
    );
  }

  list() {
    return this.http.get<{ data: PspPaymentData[]; meta: { apiVersion: '1' } }>(
      `${this.baseUrl}/payments`,
      { withCredentials: true },
    );
  }

  create(input: {
    amount: string;
    currency: string;
    merchantReference: string;
    scenario: 'SUCCESS' | 'DECLINE' | 'TIMEOUT';
  }) {
    return this.http.post<{
      data: PspPaymentData;
      meta: {
        apiVersion: '1';
        idempotentReplay: boolean;
        simulatorWebhookToken: string | null;
      };
    }>(`${this.baseUrl}/payments`, input, this.options());
  }

  action(paymentId: string, action: 'confirm' | 'capture' | 'query') {
    return this.http.post<{
      data: PspPaymentData;
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>(`${this.baseUrl}/payments/${paymentId}/${action}`, {}, this.options());
  }

  refund(paymentId: string, amount: string) {
    return this.http.post<{
      data: PspPaymentData;
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>(`${this.baseUrl}/payments/${paymentId}/refunds`, { amount }, this.options());
  }

  webhook(input: {
    token: string;
    eventId: string;
    providerReference: string;
    status: 'AUTHORIZED' | 'CAPTURED' | 'DECLINED';
    occurredAt: string;
  }) {
    const { token, ...body } = input;
    return this.http.post<{
      data: PspPaymentData;
      meta: {
        apiVersion: '1';
        idempotentReplay: boolean;
        signatureVerified: boolean;
        ignoredOutOfOrder: boolean;
      };
    }>(`${this.baseUrl}/webhooks/simulator`, body, {
      headers: new HttpHeaders({ 'x-simulator-webhook-token': token }),
      withCredentials: true,
    });
  }

  private options() {
    return {
      headers: new HttpHeaders({
        'Idempotency-Key': `web-psp-${crypto.randomUUID()}`,
      }),
      withCredentials: true,
    };
  }
}
