import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export interface CustomerData {
  id: string;
  name: string;
  identifier: string | null;
  email: string | null;
  phone: string | null;
  dataProcessingConsent: boolean;
  privacyStatus: 'ACTIVE' | 'ANONYMIZED';
  anonymizedAt: string | null;
  privacyRetentionUntil: string | null;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  credit?: CustomerCreditData | null;
  loyalty?: { balance: number };
}

export interface CustomerCreditData {
  enabled: boolean;
  limit: string;
  currency: string;
  termDays: number;
  maxInstallments: number;
  balance: string;
  available: string;
  overdueAmount: string;
  status: 'DISABLED' | 'AVAILABLE' | 'LIMIT_REACHED' | 'OVERDUE';
}

export interface CustomerCreditInput {
  enabled: boolean;
  creditLimit: string;
  currency: string;
  termDays: number;
  maxInstallments: number;
  version: number;
}

export interface CustomerInput {
  name: string;
  identifier?: string;
  email?: string;
  phone?: string;
  dataProcessingConsent: boolean;
  active?: boolean;
}

export type CustomerHistoryStatus = 'ALL' | 'COMPLETED' | 'VOIDED';

export type CustomerCreditPaymentMethod = 'CASH' | 'CARD' | 'TRANSFER';

export interface CustomerCreditPaymentData {
  id: string;
  receiptNumber: string;
  currency: string;
  amount: string;
  method: CustomerCreditPaymentMethod;
  status: 'COMPLETED' | 'REVERSED';
  reference: string | null;
  provider: string;
  providerReference: string | null;
  responsible: { id: string; email: string };
  context: {
    branch: { id: string; name: string };
    cashRegister: { id: string; name: string; code: string };
  };
  allocations: Array<{
    accountId: string;
    installmentId: string;
    installmentNumber: number;
    amount: string;
  }>;
  reversal: {
    reason: string;
    user: { id: string; email: string };
    providerReference: string | null;
    reversedAt: string;
  } | null;
  createdAt: string;
}

export interface CustomerCreditStatementData {
  currency: string;
  balance: string;
  overdueAmount: string;
  status: 'DISABLED' | 'AVAILABLE' | 'LIMIT_REACHED' | 'OVERDUE';
  accounts: Array<{
    id: string;
    sale: { id: string; receiptNumber: string };
    originalAmount: string;
    balance: string;
    dueDate: string;
    status: 'OPEN' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    installments: Array<{
      id: string;
      number: number;
      dueDate: string;
      amount: string;
      paidAmount: string;
      balance: string;
      status: 'OPEN' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    }>;
  }>;
  payments: CustomerCreditPaymentData[];
}

export interface CustomerHistoryData {
  customer: CustomerData;
  credit: CustomerCreditStatementData | null;
  summary: {
    currency: string | null;
    salesCount: number;
    completedCount: number;
    voidedCount: number;
    completedAmount: string;
    voidedAmount: string;
  };
  items: Array<{
    id: string;
    receiptNumber: string;
    status: 'COMPLETED' | 'VOIDED';
    currency: string;
    total: string;
    createdAt: string;
    cashRegister: { id: string; name: string; code: string };
    responsible: { id: string; email: string };
    payments: Array<{
      method: string;
      status: 'COMPLETED' | 'PENDING' | 'REVERSED';
      amountApplied: string;
      amountReceived: string;
      change: string;
    }>;
    reversal: { reason: string; voidedAt: string } | null;
  }>;
}

export interface CustomerHistoryResponse {
  data: CustomerHistoryData;
  meta: {
    apiVersion: '1';
    scope: { branchId: string };
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  };
}

@Injectable({ providedIn: 'root' })
export class CustomerApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  list(query: {
    q?: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
    page: number;
    pageSize: number;
  }) {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.q) params = params.set('q', query.q);
    if (query.status) params = params.set('status', query.status);
    return this.http.get<{
      data: CustomerData[];
      meta: { apiVersion: '1'; pagination: { total: number; totalPages: number } };
    }>(`${this.config.apiBaseUrl()}/customers`, { params, withCredentials: true });
  }

  create(input: CustomerInput) {
    return this.http.post<{ data: CustomerData; meta: { apiVersion: '1' } }>(
      `${this.config.apiBaseUrl()}/customers`,
      input,
      { withCredentials: true },
    );
  }

  update(id: string, input: CustomerInput & { version: number }) {
    return this.http.patch<{ data: CustomerData; meta: { apiVersion: '1' } }>(
      `${this.config.apiBaseUrl()}/customers/${id}`,
      input,
      { withCredentials: true },
    );
  }

  deactivate(id: string) {
    return this.http.delete<{ data: CustomerData; meta: { apiVersion: '1' } }>(
      `${this.config.apiBaseUrl()}/customers/${id}`,
      { withCredentials: true },
    );
  }

  configureCredit(id: string, input: CustomerCreditInput) {
    return this.http.patch<{ data: CustomerData; meta: { apiVersion: '1' } }>(
      `${this.config.apiBaseUrl()}/customers/${id}/credit`,
      input,
      { withCredentials: true },
    );
  }

  creditStatement(id: string) {
    return this.http.get<{
      data: CustomerCreditStatementData | null;
      meta: { apiVersion: '1' };
    }>(`${this.config.apiBaseUrl()}/customers/${id}/credit`, {
      withCredentials: true,
    });
  }

  createCreditPayment(
    id: string,
    input: {
      amount: string;
      method: CustomerCreditPaymentMethod;
      reference?: string;
    },
    idempotencyKey: string,
  ) {
    return this.http.post<{
      data: {
        payment: CustomerCreditPaymentData;
        credit: CustomerCreditStatementData | null;
      };
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>(`${this.config.apiBaseUrl()}/customers/${id}/credit/payments`, input, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
      withCredentials: true,
    });
  }

  reverseCreditPayment(
    customerId: string,
    paymentId: string,
    reason: string,
    idempotencyKey: string,
  ) {
    return this.http.post<{
      data: {
        payment: CustomerCreditPaymentData;
        credit: CustomerCreditStatementData | null;
      };
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>(
      `${this.config.apiBaseUrl()}/customers/${customerId}/credit/payments/${paymentId}/reversal`,
      { reason },
      {
        headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
        withCredentials: true,
      },
    );
  }

  history(
    id: string,
    query: {
      dateFrom?: string;
      dateTo?: string;
      status: CustomerHistoryStatus;
      page: number;
      pageSize: number;
    },
  ) {
    let params = new HttpParams()
      .set('status', query.status)
      .set('page', query.page)
      .set('pageSize', query.pageSize);
    if (query.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query.dateTo) params = params.set('dateTo', query.dateTo);
    return this.http.get<CustomerHistoryResponse>(
      `${this.config.apiBaseUrl()}/customers/${id}/history`,
      { params, withCredentials: true },
    );
  }
}
