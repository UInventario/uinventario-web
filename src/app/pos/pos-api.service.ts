import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export interface PosCartQuote {
  context: {
    branch: { id: string; name: string };
    warehouse: { id: string; name: string };
    cashRegister: { id: string; name: string; code: string };
  };
  currency: string;
  taxRate: string;
  lines: Array<{
    product: { id: string; name: string; sku: string };
    quantity: string;
    availableQuantity: string;
    unitPrice: string;
    subtotal: string;
    tax: string;
    total: string;
  }>;
  totals: { subtotal: string; tax: string; total: string };
}

interface PosCartQuoteResponse {
  data: PosCartQuote;
  meta: { apiVersion: '1'; recalculatedAt: string };
}

export interface CashSaleData {
  id: string;
  receiptNumber: string;
  status: 'COMPLETED';
  context: PosCartQuote['context'];
  userId: string;
  currency: string;
  taxRate: string;
  lines: Array<Omit<PosCartQuote['lines'][number], 'availableQuantity'>>;
  totals: PosCartQuote['totals'];
  payment: {
    method: 'CASH';
    amountReceived: string;
    amountApplied: string;
    change: string;
  };
  createdAt: string;
}

interface CashSaleResponse {
  data: CashSaleData;
  meta: { apiVersion: '1'; idempotentReplay: boolean };
}

@Injectable({ providedIn: 'root' })
export class PosApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  quote(lines: Array<{ productId: string; quantity: string }>) {
    return this.http.post<PosCartQuoteResponse>(
      `${this.config.apiBaseUrl()}/pos/cart/quote`,
      { lines },
      { withCredentials: true },
    );
  }

  createCashSale(
    input: {
      lines: Array<{ productId: string; quantity: string }>;
      cashReceived: string;
    },
    idempotencyKey: string,
  ) {
    return this.http.post<CashSaleResponse>(`${this.config.apiBaseUrl()}/pos/sales/cash`, input, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
      withCredentials: true,
    });
  }
}
