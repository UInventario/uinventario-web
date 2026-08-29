import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';
import type {
  CollectedPaymentMethod,
  PosCartQuote,
  SaleDiscountInput,
} from '../pos/pos-api.service';

export type SalesQuotationStatus = 'ACTIVE' | 'EXPIRED' | 'CONVERTING' | 'CONVERTED';

export interface SalesQuotationData {
  id: string;
  quotationNumber: string;
  status: SalesQuotationStatus;
  version: number;
  channel: 'POS' | 'WEB' | 'MOBILE' | 'DESKTOP';
  customer: { id: string; name: string; identifier: string | null } | null;
  reservation: { id: string; reservationNumber: string; status: string } | null;
  sale: { id: string; receiptNumber: string } | null;
  context: PosCartQuote['context'];
  currency: string;
  taxRate: string;
  discount: (SaleDiscountInput & { amount: string }) | null;
  lines: PosCartQuote['lines'];
  totals: PosCartQuote['totals'];
  validUntil: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  convertedAt: string | null;
}

export interface SalesQuotationInput {
  customerId?: string;
  reservationId?: string;
  channel: SalesQuotationData['channel'];
  validUntil: string;
  notes?: string;
  lines: Array<{ productId: string; quantity: string }>;
}

export interface QuotationDifference {
  product: { id: string; name: string; sku: string };
  field: 'UNIT_PRICE' | 'AVAILABLE_STOCK' | 'TOTAL';
  quoted: string;
  current: string;
  blocking: boolean;
}

export interface SalesQuotationPreview {
  quotation: SalesQuotationData;
  recalculated: PosCartQuote;
  differences: QuotationDifference[];
  canConvert: boolean;
}

interface QuotationResponse {
  data: SalesQuotationData;
  meta: { apiVersion: '1'; idempotentReplay: boolean };
}

@Injectable({ providedIn: 'root' })
export class SalesQuotationApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  list(query: { status?: SalesQuotationStatus; page?: number; pageSize?: number }) {
    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('pageSize', String(query.pageSize ?? 20));
    if (query.status) params = params.set('status', query.status);
    return this.http.get<{
      data: SalesQuotationData[];
      meta: {
        apiVersion: '1';
        pagination: {
          page: number;
          pageSize: number;
          total: number;
          totalPages: number;
        };
      };
    }>(`${this.config.apiBaseUrl()}/quotations`, { params, withCredentials: true });
  }

  create(input: SalesQuotationInput, key: string) {
    return this.http.post<QuotationResponse>(
      `${this.config.apiBaseUrl()}/quotations`,
      input,
      this.options(key),
    );
  }

  update(id: string, input: SalesQuotationInput & { version: number }, key: string) {
    return this.http.put<QuotationResponse>(
      `${this.config.apiBaseUrl()}/quotations/${id}`,
      input,
      this.options(key),
    );
  }

  preview(id: string) {
    return this.http.post<{
      data: SalesQuotationPreview;
      meta: { apiVersion: '1'; recalculatedAt: string };
    }>(`${this.config.apiBaseUrl()}/quotations/${id}/preview`, {}, { withCredentials: true });
  }

  convert(
    id: string,
    input: {
      version: number;
      acceptDifferences: boolean;
      payments: Array<{
        method: CollectedPaymentMethod;
        amountReceived?: string;
        reference?: string;
      }>;
    },
    key: string,
  ) {
    return this.http.post<{
      data: {
        quotation: SalesQuotationData;
        sale: { id: string; receiptNumber: string };
        differences: QuotationDifference[];
      };
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>(`${this.config.apiBaseUrl()}/quotations/${id}/convert`, input, this.options(key));
  }

  private options(key: string) {
    return { withCredentials: true, headers: new HttpHeaders({ 'Idempotency-Key': key }) };
  }
}
