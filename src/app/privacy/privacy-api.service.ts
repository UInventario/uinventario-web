import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { CustomerData } from '../customers/customer-api.service';
import { RuntimeConfigService } from '../core/runtime-config.service';

export interface PrivacyPolicyData {
  countryCode: string;
  minimumTransactionRetentionDays: number;
  transactionRetentionDays: number;
  policyCode: string;
  version: number;
  updatedAt: string;
}

export interface PrivacyReportData {
  subject: CustomerData;
  transactions: {
    count: number;
    firstAt: string | null;
    lastAt: string | null;
    retainedUntil: string | null;
    disposition: 'PRESERVED_WITHOUT_CASCADE_DELETE';
  };
  policy: PrivacyPolicyData;
  activeLegalHold: {
    id: string;
    active: boolean;
    reason: string;
    expiresAt: string | null;
    createdAt: string;
  } | null;
  recentDecisions: Array<{
    id: string;
    type: string;
    status: 'COMPLETED' | 'BLOCKED';
    decisionCode: string;
    requestReference: string | null;
    createdAt: string;
  }>;
  propagation: {
    primaryDatabase: string;
    logs: string;
    backups: string;
    integrations: string;
  };
}

interface ApiResponse<T> {
  data: T;
  meta: { apiVersion: '1' };
}

@Injectable({ providedIn: 'root' })
export class PrivacyApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  classification() {
    return this.http.get<
      ApiResponse<{
        version: number;
        classes: Array<{ code: string; fields: string[]; controls: string[] }>;
        correctionEndpoint: string;
        deletionMode: string;
      }>
    >(`${this.config.apiBaseUrl()}/privacy/classification`, { withCredentials: true });
  }

  policy() {
    return this.http.get<ApiResponse<PrivacyPolicyData>>(
      `${this.config.apiBaseUrl()}/privacy/policy`,
      { withCredentials: true },
    );
  }

  updatePolicy(
    input: {
      expectedVersion: number;
      transactionRetentionDays: number;
      reason: string;
      requestReference?: string;
    },
    idempotencyKey: string,
  ) {
    return this.http.patch<ApiResponse<PrivacyPolicyData>>(
      `${this.config.apiBaseUrl()}/privacy/policy`,
      input,
      this.options(idempotencyKey),
    );
  }

  report(customerId: string) {
    return this.http.get<ApiResponse<PrivacyReportData>>(
      `${this.config.apiBaseUrl()}/privacy/customers/${customerId}/report`,
      { withCredentials: true },
    );
  }

  export(customerId: string) {
    return this.http.get(`${this.config.apiBaseUrl()}/privacy/customers/${customerId}/export`, {
      withCredentials: true,
      responseType: 'blob',
    });
  }

  createLegalHold(
    customerId: string,
    input: { reason: string; requestReference?: string; expiresAt?: string },
    idempotencyKey: string,
  ) {
    return this.http.post<ApiResponse<PrivacyReportData['activeLegalHold']>>(
      `${this.config.apiBaseUrl()}/privacy/customers/${customerId}/legal-holds`,
      input,
      this.options(idempotencyKey),
    );
  }

  releaseLegalHold(
    customerId: string,
    input: { reason: string; requestReference?: string },
    idempotencyKey: string,
  ) {
    return this.http.post<ApiResponse<{ released: boolean }>>(
      `${this.config.apiBaseUrl()}/privacy/customers/${customerId}/legal-holds/release`,
      input,
      this.options(idempotencyKey),
    );
  }

  anonymize(
    customerId: string,
    input: { reason: string; requestReference?: string },
    idempotencyKey: string,
  ) {
    return this.http.post<
      ApiResponse<{
        anonymized: boolean;
        privacyStatus: 'ANONYMIZED';
        retainedUntil: string | null;
      }>
    >(
      `${this.config.apiBaseUrl()}/privacy/customers/${customerId}/anonymization`,
      input,
      this.options(idempotencyKey),
    );
  }

  private options(idempotencyKey: string) {
    return {
      withCredentials: true,
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
    };
  }
}
