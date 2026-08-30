import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export interface AccountingConfigData {
  provider: 'SIMULATOR';
  contractVersion: '1';
  paymentClearingAccount: string;
  salesRevenueAccount: string;
  salesReturnsAccount: string;
  taxPayableAccount: string;
  inventoryAssetAccount: string;
  costOfGoodsSoldAccount: string;
  cashAccount: string;
  cashClearingAccount: string;
  updatedAt: string;
}

export interface AccountingEventData {
  id: string;
  eventKey: string;
  sourceType: 'SALE' | 'SALE_VOID' | 'SALE_RETURN' | 'CASH_MOVEMENT';
  sourceId: string;
  provider: 'SIMULATOR';
  contractVersion: '1';
  currency: string;
  occurredAt: string;
  reference: string;
  journalStatus: 'CANDIDATE_NOT_POSTED';
  entries: Array<{ accountReference: string; debit: string; credit: string; memo: string }>;
  debitTotal: string;
  creditTotal: string;
  status: 'PENDING' | 'EXPORTED' | 'REJECTED' | 'INDETERMINATE';
  attemptCount: number;
  errorCode: string | null;
  providerReference: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class AccountingApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);
  private readonly baseUrl = `${this.config.apiBaseUrl()}/integrations/accounting/v1`;

  contract() {
    return this.http.get<{ data: { sources: string[]; journalStatus: string }; meta: unknown }>(
      `${this.baseUrl}/contract`,
      { withCredentials: true },
    );
  }

  configData() {
    return this.http.get<{ data: AccountingConfigData | null; meta: unknown }>(
      `${this.baseUrl}/config`,
      { withCredentials: true },
    );
  }

  saveConfig(input: Omit<AccountingConfigData, 'provider' | 'contractVersion' | 'updatedAt'>) {
    return this.http.put<{ data: AccountingConfigData; meta: unknown }>(
      `${this.baseUrl}/config`,
      input,
      { withCredentials: true },
    );
  }

  events() {
    return this.http.get<{ data: AccountingEventData[]; meta: unknown }>(`${this.baseUrl}/events`, {
      withCredentials: true,
    });
  }

  generate() {
    return this.http.post<{
      data: AccountingEventData[];
      meta: { discovered: number; created: number };
    }>(`${this.baseUrl}/events/generate`, {}, { withCredentials: true });
  }

  deliver(eventId: string, scenario: 'SUCCESS' | 'REJECT' | 'TIMEOUT') {
    return this.http.post<{ data: AccountingEventData; meta: unknown }>(
      `${this.baseUrl}/events/${eventId}/deliver`,
      { scenario },
      this.options('deliver'),
    );
  }

  reconcile(eventId: string) {
    return this.http.post<{ data: AccountingEventData; meta: unknown }>(
      `${this.baseUrl}/events/${eventId}/reconcile`,
      {},
      this.options('reconcile'),
    );
  }

  private options(action: string) {
    return {
      headers: new HttpHeaders({
        'Idempotency-Key': `web-accounting-${action}-${crypto.randomUUID()}`,
      }),
      withCredentials: true,
    };
  }
}
