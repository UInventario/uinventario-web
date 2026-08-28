import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
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
    lotId?: string | null;
    serialNumbers?: string[];
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

export interface CashRegisterShiftData {
  id: string;
  status: 'OPEN';
  branch: { id: string; name: string };
  cashRegister: { id: string; name: string; code: string };
  openedBy: { id: string; email: string };
  openingAmount: string;
  currency: string;
  openedAt: string;
}

export interface CashRegisterMovementData {
  id: string;
  type: 'INCOME' | 'WITHDRAWAL' | 'REVERSAL';
  amount: string;
  reason: string;
  responsible: { id: string; email: string };
  reversalOf: {
    id: string;
    type: 'INCOME' | 'WITHDRAWAL';
    reason: string;
  } | null;
  reversed: boolean;
  createdAt: string;
}

export interface CashRegisterClosureData {
  id: string;
  status: 'CLOSED';
  branch: { id: string; name: string };
  cashRegister: { id: string; name: string; code: string };
  openedBy: { id: string; email: string };
  closedBy: { id: string; email: string };
  currency: string;
  openingAmount: string;
  salesCount: number;
  cashSales: string;
  movementsCount: number;
  movementsNet: string;
  expectedCash: string;
  countedCash: string;
  difference: string;
  differenceReason: string | null;
  denominations: Array<{ denomination: string; quantity: number }>;
  openedAt: string;
  closedAt: string;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'VOUCHER';

export interface SalePaymentData {
  method: PaymentMethod;
  status: 'COMPLETED' | 'REVERSED';
  amountReceived: string;
  amountApplied: string;
  change: string;
  reference: string | null;
  provider: string;
  authorizationCode: string | null;
}

export interface CashSaleData {
  id: string;
  receiptNumber: string;
  status: 'COMPLETED' | 'VOIDED';
  context: PosCartQuote['context'];
  userId: string;
  customer?: { id: string; name: string; identifier: string | null } | null;
  currency: string;
  taxRate: string;
  lines: Array<Omit<PosCartQuote['lines'][number], 'availableQuantity'>>;
  totals: PosCartQuote['totals'];
  payment: SalePaymentData;
  payments: SalePaymentData[];
  createdAt: string;
  void: {
    reason: string;
    user: { id: string; email: string };
    voidedAt: string;
  } | null;
}

interface CashSaleResponse {
  data: CashSaleData;
  meta: { apiVersion: '1'; idempotentReplay: boolean };
}

export interface SaleSummaryData {
  id: string;
  receiptNumber: string;
  status: 'COMPLETED' | 'VOIDED';
  user: { id: string; email: string };
  customer?: { id: string; name: string; identifier: string | null } | null;
  cashRegister: { id: string; name: string; code: string };
  currency: string;
  total: string;
  paymentMethod: PaymentMethod | 'MIXED';
  createdAt: string;
}

export interface SaleDetailData extends Omit<CashSaleData, 'userId'> {
  user: { id: string; email: string };
  movements: Array<{
    id: string;
    type: 'SALE' | 'SALE_VOID';
    saleLineId: string;
    product: { id: string; name: string; sku: string };
    location: { id: string; name: string; code: string };
    quantityChange: string;
    resultingQuantity: string;
    reference: string;
    createdAt: string;
  }>;
}

export interface SalesCashReportData {
  scope: Array<{ id: string; name: string; timezone: string }>;
  options: {
    branches: Array<{ id: string; name: string; timezone: string }>;
    registers: Array<{ id: string; name: string; code: string; branch_id: string }>;
    users: Array<{ id: string; email: string }>;
  };
  summary: {
    sales: {
      total: number;
      completed: number;
      voided: number;
      net: string;
      voidedAmount: string;
    };
    payments: Array<{
      method: PaymentMethod;
      status: 'COMPLETED' | 'REVERSED';
      count: number;
      amount: string;
    }>;
    cash: {
      shifts: number;
      open: number;
      closed: number;
      expected: string;
      counted: string;
      difference: string;
    };
    reconciliation: { salesNet: string; paymentsApplied: string; matches: boolean };
  };
  sales: Array<{
    id: string;
    receiptNumber: string;
    status: 'COMPLETED' | 'VOIDED';
    branch: { id: string; name: string };
    cashRegister: { id: string; name: string; code: string };
    user: { id: string; email: string };
    currency: string;
    total: string;
    payments: Array<{
      method: PaymentMethod;
      status: 'COMPLETED' | 'REVERSED';
      amount: string;
      change: string;
      reference: string | null;
    }>;
    createdAt: string;
    voidedAt: string | null;
  }>;
  shifts: Array<{
    id: string;
    status: 'OPEN' | 'CLOSED';
    branch: { id: string; name: string };
    cashRegister: { id: string; name: string; code: string };
    openedByEmail: string;
    currency: string;
    opening: string;
    expected: string;
    counted: string | null;
    difference: string | null;
    openedAt: string;
    closedAt: string | null;
  }>;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class PosApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  getCurrentShift() {
    return this.http.get<{
      data: CashRegisterShiftData | null;
      meta: { apiVersion: '1' };
    }>(`${this.config.apiBaseUrl()}/pos/register-shifts/current`, {
      withCredentials: true,
    });
  }

  openShift(openingAmount: string, idempotencyKey: string) {
    return this.http.post<{
      data: CashRegisterShiftData;
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>(
      `${this.config.apiBaseUrl()}/pos/register-shifts`,
      { openingAmount },
      {
        headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
        withCredentials: true,
      },
    );
  }

  listCashMovements() {
    return this.http.get<{
      data: CashRegisterMovementData[];
      meta: {
        apiVersion: '1';
        shiftId: string;
        currency: string;
        expectedCash: string;
      };
    }>(`${this.config.apiBaseUrl()}/pos/register-shifts/current/movements`, {
      withCredentials: true,
    });
  }

  createCashMovement(
    input: { type: 'INCOME' | 'WITHDRAWAL'; amount: string; reason: string },
    idempotencyKey: string,
  ) {
    return this.http.post<{
      data: CashRegisterMovementData;
      meta: { apiVersion: '1'; expectedCash: string; idempotentReplay: boolean };
    }>(`${this.config.apiBaseUrl()}/pos/register-shifts/current/movements`, input, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
      withCredentials: true,
    });
  }

  reverseCashMovement(movementId: string, reason: string, idempotencyKey: string) {
    return this.http.post<{
      data: CashRegisterMovementData;
      meta: { apiVersion: '1'; expectedCash: string; idempotentReplay: boolean };
    }>(
      `${this.config.apiBaseUrl()}/pos/register-shifts/current/movements/${movementId}/reversals`,
      { reason },
      {
        headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
        withCredentials: true,
      },
    );
  }

  getLatestClosure() {
    return this.http.get<{
      data: CashRegisterClosureData | null;
      meta: { apiVersion: '1' };
    }>(`${this.config.apiBaseUrl()}/pos/register-shifts/latest-closed`, {
      withCredentials: true,
    });
  }

  closeShift(
    input: {
      countedAmount: string;
      differenceReason?: string;
      denominations?: Array<{ denomination: string; quantity: number }>;
    },
    idempotencyKey: string,
  ) {
    return this.http.post<{
      data: CashRegisterClosureData;
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>(`${this.config.apiBaseUrl()}/pos/register-shifts/current/closure`, input, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
      withCredentials: true,
    });
  }

  quote(
    lines: Array<{
      productId: string;
      quantity: string;
      lotId?: string;
      serialNumbers?: string[];
    }>,
    reservationId?: string,
  ) {
    return this.http.post<PosCartQuoteResponse>(
      `${this.config.apiBaseUrl()}/pos/cart/quote`,
      { lines, ...(reservationId ? { reservationId } : {}) },
      { withCredentials: true },
    );
  }

  getPaymentOptions() {
    return this.http.get<{
      data: { methods: PaymentMethod[]; nonCashProvider: 'SIMULATOR' | 'DISABLED' };
      meta: { apiVersion: '1' };
    }>(`${this.config.apiBaseUrl()}/pos/payment-options`, { withCredentials: true });
  }

  createSale(
    input: {
      lines: Array<{
        productId: string;
        quantity: string;
        lotId?: string;
        serialNumbers?: string[];
      }>;
      customerId?: string;
      reservationId?: string;
      payment?: { method: PaymentMethod; amountReceived?: string; reference?: string };
      payments?: Array<{
        method: PaymentMethod;
        amount: string;
        amountReceived?: string;
        reference?: string;
      }>;
    },
    idempotencyKey: string,
  ) {
    return this.http.post<CashSaleResponse>(`${this.config.apiBaseUrl()}/pos/sales`, input, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
      withCredentials: true,
    });
  }

  createCashSale(
    input: {
      lines: Array<{ productId: string; quantity: string }>;
      cashReceived: string;
      customerId?: string;
      reservationId?: string;
    },
    idempotencyKey: string,
  ) {
    return this.http.post<CashSaleResponse>(`${this.config.apiBaseUrl()}/pos/sales/cash`, input, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
      withCredentials: true,
    });
  }

  listSales(query: {
    dateFrom?: string;
    dateTo?: string;
    cashRegisterId?: string;
    userId?: string;
    page: number;
    pageSize: number;
  }) {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    for (const [key, value] of Object.entries(query)) {
      if (key !== 'page' && key !== 'pageSize' && value) {
        params = params.set(key, value);
      }
    }
    return this.http.get<{
      data: SaleSummaryData[];
      meta: {
        apiVersion: '1';
        pagination: {
          page: number;
          pageSize: number;
          total: number;
          totalPages: number;
        };
      };
    }>(`${this.config.apiBaseUrl()}/pos/sales`, {
      params,
      withCredentials: true,
    });
  }

  getSale(id: string) {
    return this.http.get<{
      data: SaleDetailData;
      meta: { apiVersion: '1' };
    }>(`${this.config.apiBaseUrl()}/pos/sales/${id}`, {
      withCredentials: true,
    });
  }

  salesCashReport(query: {
    dateFrom?: string;
    dateTo?: string;
    branchId?: string;
    cashRegisterId?: string;
    userId?: string;
    status?: 'ALL' | 'COMPLETED' | 'VOIDED';
    page: number;
    pageSize: number;
  }) {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    for (const [key, value] of Object.entries(query)) {
      if (key !== 'page' && key !== 'pageSize' && value) params = params.set(key, value);
    }
    return this.http.get<{
      data: SalesCashReportData;
      meta: {
        apiVersion: '1';
        pagination: { page: number; pageSize: number; total: number; totalPages: number };
        periodTimezone: 'BRANCH_LOCAL';
      };
    }>(`${this.config.apiBaseUrl()}/pos/reports/sales-cash`, {
      params,
      withCredentials: true,
    });
  }

  voidSale(id: string, reason: string, idempotencyKey: string) {
    return this.http.post<{
      data: SaleDetailData;
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>(
      `${this.config.apiBaseUrl()}/pos/sales/${id}/void`,
      { reason },
      {
        headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
        withCredentials: true,
      },
    );
  }
}
