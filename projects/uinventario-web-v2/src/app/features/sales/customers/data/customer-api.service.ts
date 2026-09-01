import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../../../../core/api/api-client';
import { ApiEnvelope } from '../../../../core/api/api-contracts';
import { API_BASE_URL } from '../../../../core/api/api-runtime-config';
import { CustomerGateway } from '../domain/customer.gateway';
import {
  CreditInput,
  Customer,
  CustomerCreditPaymentInput,
  CustomerCreditPaymentResult,
  CustomerCreditStatement,
  CustomerHistory,
  CustomerInput,
  CustomerPrivacyReport,
  CustomerQuery,
  LegalHoldInput,
  Pagination,
  PrivacyActionInput,
  PrivacyLegalHold,
  PrivacyPolicy,
  PrivacyPolicyInput,
} from '../domain/customer.models';

interface CustomerListResponse {
  readonly data: readonly Customer[];
  readonly meta: { readonly pagination: Pagination };
}

interface HistoryResponse {
  readonly data: CustomerHistory;
  readonly meta: { readonly pagination: Pagination };
}

@Injectable()
export class CustomerApi extends CustomerGateway {
  private readonly api = inject(ApiClient);
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  override list(query: CustomerQuery) {
    const params: Record<string, string | number> = {
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    };
    if (query.q) params['q'] = query.q;
    return this.api
      .get<CustomerListResponse>('/customers', { params })
      .pipe(map(({ data, meta }) => ({ customers: data, pagination: meta.pagination })));
  }

  override get(id: string) {
    return this.api
      .get<ApiEnvelope<Customer>>(`/customers/${encodeURIComponent(id)}`)
      .pipe(map(({ data }) => data));
  }

  override create(input: CustomerInput) {
    return this.api
      .post<ApiEnvelope<Customer>, CustomerInput>('/customers', input)
      .pipe(map(({ data }) => data));
  }

  override update(id: string, input: CustomerInput, version: number) {
    return this.api
      .patch<ApiEnvelope<Customer>, CustomerInput & { readonly version: number }>(
        `/customers/${encodeURIComponent(id)}`,
        { ...input, version },
      )
      .pipe(map(({ data }) => data));
  }

  override deactivate(id: string) {
    return this.api
      .delete<ApiEnvelope<Customer>>(`/customers/${encodeURIComponent(id)}`)
      .pipe(map(({ data }) => data));
  }

  override history(id: string) {
    return this.api
      .get<HistoryResponse>(`/customers/${encodeURIComponent(id)}/history`, {
        params: { status: 'ALL', page: 1, pageSize: 20 },
      })
      .pipe(map(({ data, meta }) => ({ history: data, pagination: meta.pagination })));
  }

  override credit(id: string) {
    return this.api
      .get<ApiEnvelope<CustomerCreditStatement>>(`/customers/${encodeURIComponent(id)}/credit`)
      .pipe(map(({ data }) => data));
  }

  override configureCredit(id: string, input: CreditInput) {
    return this.api
      .patch<ApiEnvelope<Customer>, CreditInput>(
        `/customers/${encodeURIComponent(id)}/credit`,
        input,
      )
      .pipe(map(({ data }) => data));
  }

  override createCreditPayment(id: string, input: CustomerCreditPaymentInput) {
    return this.api
      .post<ApiEnvelope<CustomerCreditPaymentResult>, CustomerCreditPaymentInput>(
        `/customers/${encodeURIComponent(id)}/credit/payments`,
        input,
        { headers: this.idempotencyHeaders() },
      )
      .pipe(map(({ data }) => data));
  }

  override reverseCreditPayment(customerId: string, paymentId: string, reason: string) {
    return this.api
      .post<ApiEnvelope<CustomerCreditPaymentResult>, { readonly reason: string }>(
        `/customers/${encodeURIComponent(customerId)}/credit/payments/${encodeURIComponent(paymentId)}/reversal`,
        { reason },
        { headers: this.idempotencyHeaders() },
      )
      .pipe(map(({ data }) => data));
  }

  override privacyPolicy() {
    return this.api
      .get<ApiEnvelope<PrivacyPolicy>>('/privacy/policy')
      .pipe(map(({ data }) => data));
  }

  override updatePrivacyPolicy(input: PrivacyPolicyInput) {
    return this.api
      .patch<ApiEnvelope<PrivacyPolicy>, PrivacyPolicyInput>('/privacy/policy', input, {
        headers: this.idempotencyHeaders(),
      })
      .pipe(map(({ data }) => data));
  }

  override privacyReport(id: string) {
    return this.api
      .get<ApiEnvelope<CustomerPrivacyReport>>(
        `/privacy/customers/${encodeURIComponent(id)}/report`,
      )
      .pipe(map(({ data }) => data));
  }

  override exportPrivacy(id: string) {
    return this.http.get(`${this.apiBaseUrl}/privacy/customers/${encodeURIComponent(id)}/export`, {
      responseType: 'blob',
    });
  }

  override createLegalHold(id: string, input: LegalHoldInput) {
    return this.api
      .post<ApiEnvelope<PrivacyLegalHold>, LegalHoldInput>(
        `/privacy/customers/${encodeURIComponent(id)}/legal-holds`,
        input,
        { headers: this.idempotencyHeaders() },
      )
      .pipe(map(({ data }) => data));
  }

  override releaseLegalHold(id: string, input: PrivacyActionInput) {
    return this.api
      .post<ApiEnvelope<{ readonly released: boolean }>, PrivacyActionInput>(
        `/privacy/customers/${encodeURIComponent(id)}/legal-holds/release`,
        input,
        { headers: this.idempotencyHeaders() },
      )
      .pipe(map(({ data }) => data));
  }

  override anonymize(id: string, input: PrivacyActionInput) {
    return this.api
      .post<ApiEnvelope<{ readonly anonymized: boolean }>, PrivacyActionInput>(
        `/privacy/customers/${encodeURIComponent(id)}/anonymization`,
        input,
        { headers: this.idempotencyHeaders() },
      )
      .pipe(map(({ data }) => data));
  }

  private idempotencyHeaders(): HttpHeaders {
    return new HttpHeaders({ 'Idempotency-Key': `web-${crypto.randomUUID()}` });
  }
}
