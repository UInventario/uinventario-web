import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export interface SaleDiscountInput {
  type: 'PERCENT' | 'AMOUNT';
  value: string;
  reason: string;
}

export interface AppliedSaleDiscount extends SaleDiscountInput {
  amount: string;
}

export interface PosCartQuote {
  context: {
    branch: { id: string; name: string };
    warehouse: { id: string; name: string };
    cashRegister: { id: string; name: string; code: string };
  };
  currency: string;
  taxRate: string;
  discount: AppliedSaleDiscount | null;
  lines: Array<{
    product: { id: string; name: string; sku: string };
    quantity: string;
    lotId?: string | null;
    expiredLotOverrideReason?: string | null;
    serialNumbers?: string[];
    availableQuantity: string;
    unitPrice: string;
    priceSource: 'BASE' | 'PRICE_LIST';
    priceList: { id: string; name: string } | null;
    grossTotal: string;
    discount: {
      line: AppliedSaleDiscount | null;
      sale: AppliedSaleDiscount | null;
      total: string;
    };
    subtotal: string;
    tax: string;
    total: string;
  }>;
  totals: {
    gross: string;
    lineDiscount: string;
    saleDiscount: string;
    discount: string;
    subtotal: string;
    tax: string;
    total: string;
  };
}

interface PosCartQuoteResponse {
  data: PosCartQuote;
  meta: { apiVersion: '1'; recalculatedAt: string };
}

export type SuspendedSaleStatus = 'ACTIVE' | 'CANCELLED' | 'RESUMED' | 'EXPIRED';

export interface SuspendedSaleData {
  id: string;
  status: SuspendedSaleStatus;
  context: PosCartQuote['context'];
  author: { id: string; email: string };
  customer: { id: string; name: string; identifier: string | null } | null;
  notes: string | null;
  lines: Array<{
    product: { id: string; name: string; sku: string };
    quantity: string;
    lotId: string | null;
    serialNumbers: string[];
    unitPriceSnapshot: string;
    availableQuantitySnapshot: string;
  }>;
  completedSaleId: string | null;
  expiresAt: string;
  createdAt: string;
  cancelledAt: string | null;
  resumedAt: string | null;
}

export interface SuspendedSaleConflict {
  code: 'PRICE_CHANGED' | 'AVAILABILITY_CHANGED' | 'INSUFFICIENT_STOCK' | 'PRODUCT_NOT_AVAILABLE';
  productId: string;
  previous?: string;
  current?: string;
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

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'VOUCHER' | 'CREDIT';
export type CollectedPaymentMethod = Exclude<PaymentMethod, 'CREDIT'>;

export interface SalePaymentData {
  id: string;
  method: PaymentMethod;
  status: 'COMPLETED' | 'PENDING' | 'REVERSED';
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
  discount: AppliedSaleDiscount | null;
  lines: Array<
    Omit<PosCartQuote['lines'][number], 'availableQuantity'> & {
      id: string;
      grossProfit: string | null;
    }
  >;
  totals: PosCartQuote['totals'] & { grossProfit: string | null };
  payment: SalePaymentData;
  payments: SalePaymentData[];
  credit?: SaleCreditPlanData | null;
  createdAt: string;
  void: {
    reason: string;
    user: { id: string; email: string };
    voidedAt: string;
  } | null;
}

export interface SaleCreditPlanData {
  accountId: string;
  originalAmount: string;
  balance: string;
  currency: string;
  termDays: number;
  status: 'OPEN' | 'OVERDUE' | 'PAID' | 'CANCELLED';
  dueDate: string;
  installments: Array<{ number: number; dueDate: string; amount: string }>;
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
    type: 'SALE' | 'SALE_VOID' | 'SALE_RETURN';
    saleLineId: string;
    product: { id: string; name: string; sku: string };
    location: { id: string; name: string; code: string };
    quantityChange: string;
    resultingQuantity: string;
    reference: string;
    createdAt: string;
  }>;
}

export interface SaleReceiptData {
  saleId: string;
  receiptNumber: string;
  documentType: 'NON_FISCAL_SALE_RECEIPT';
  fiscalNotice: 'COMPROBANTE NO FISCAL';
  merchant: { name: string; legalName: string | null; countryCode: string | null };
  branchName: string;
  cashRegister: { name: string; code: string };
  sellerEmail: string;
  customer: { name: string; identifier: string | null } | null;
  currency: string;
  taxRate: string;
  lines: Array<{
    lineNumber: number;
    productName: string;
    productSku: string;
    quantity: string;
    unitPrice: string;
    grossTotal: string;
    discountTotal: string;
    lineDiscountReason: string | null;
    saleDiscountReason: string | null;
    subtotal: string;
    tax: string;
    total: string;
  }>;
  payments: Array<{
    method: PaymentMethod;
    amountReceived: string;
    amountApplied: string;
    change: string;
    reference: string | null;
    provider: string;
    authorizationCode: string | null;
  }>;
  totals: { gross: string; discount: string; subtotal: string; tax: string; total: string };
  issuedAt: string;
  saleStatus: 'COMPLETED' | 'VOIDED';
  void: { reason: string; voidedAt: string } | null;
}

export interface SaleReceiptDeliveryData {
  mode: 'SIMULATED';
  channel: 'EMAIL';
  recipient: string;
  messageId: string;
  acceptedAt: string;
}

export interface PosPeripheralProfileData {
  id: string;
  cashRegister: { id: string; name: string; code: string };
  deviceId: string;
  label: string;
  adapter: 'SIMULATOR';
  printerEnabled: boolean;
  drawerEnabled: boolean;
  autoOpenCashSale: boolean;
  updatedAt: string;
}

export interface PosPeripheralOperationData {
  id: string;
  action: 'PRINT_RECEIPT' | 'OPEN_DRAWER';
  trigger: 'MANUAL' | 'CASH_SALE_COMPLETED';
  status: 'COMPLETED' | 'FAILED';
  attemptCount: number;
  errorCode: string | null;
  saleId: string | null;
  deviceId: string;
  createdAt: string;
  completedAt: string | null;
}

export type SaleReturnCondition = 'SELLABLE' | 'DAMAGED';

export interface SaleReturnSettlementData {
  id: string;
  mode: 'REFUND' | 'STORE_CREDIT';
  method: PaymentMethod | 'STORE_CREDIT';
  status: 'COMPLETED' | 'FAILED';
  currency: string;
  amount: string;
  originalPayment: { id: string; method: PaymentMethod } | null;
  provider: string;
  providerReference: string | null;
  failureCode: string | null;
  processedBy: { id: string; email: string };
  createdAt: string;
}

export interface SaleReturnData {
  id: string;
  saleId: string;
  exchangeSale: { id: string; receiptNumber: string } | null;
  reason: string;
  settlementStatus: 'PENDING' | 'PARTIALLY_SETTLED' | 'SETTLED';
  refundableAmount: string;
  totals: { subtotal: string; tax: string; total: string };
  returnedBy: { id: string; email: string };
  createdAt: string;
  settlements: SaleReturnSettlementData[];
  lines: Array<{
    id: string;
    saleLineId: string;
    product: { id: string; name: string; sku: string };
    quantity: string;
    condition: SaleReturnCondition;
    totals: { subtotal: string; tax: string; total: string };
    serialNumbers: string[];
  }>;
}

export interface CreateSaleReturnInput {
  reason: string;
  exchangeSaleId?: string;
  lines: Array<{
    saleLineId: string;
    quantity: string;
    condition: SaleReturnCondition;
    serialNumbers?: string[];
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
      status: 'COMPLETED' | 'PENDING' | 'REVERSED';
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
      status: 'COMPLETED' | 'PENDING' | 'REVERSED';
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

export interface PosProfitabilityReportData {
  scope: Array<{ id: string; name: string; timezone: string }>;
  formulas: Record<
    | 'grossRevenue'
    | 'discounts'
    | 'netRevenue'
    | 'taxes'
    | 'cost'
    | 'margin'
    | 'returnsAndRefunds'
    | 'credit'
    | 'cancellations',
    string
  >;
  currencies: Array<{
    currency: string;
    sales: number;
    returns: number;
    cancellations: number;
    grossRevenue: string;
    discounts: string;
    salesTotal: string;
    returnTotal: string;
    netTotal: string;
    netRevenue: string;
    taxes: string;
    historicalCost: string;
    returnedCost: string;
    netCost: string;
    margin: string;
    marginRate: number | null;
    paymentObligations: string;
    creditSales: string;
    refundsSettled: string;
    voidedAmount: string;
    salesMatchPayments: boolean;
  }>;
  products: Array<{
    product: { id: string; name: string; sku: string };
    currency: string;
    soldQuantity: string;
    returnedQuantity: string;
    grossRevenue: string;
    discounts: string;
    netRevenue: string;
    taxes: string;
    netCost: string;
    margin: string;
  }>;
  activities: Array<{
    id: string;
    type: 'SALE' | 'RETURN' | 'VOID';
    saleId: string;
    receiptNumber: string;
    branchName: string;
    cashRegisterName: string;
    currency: string;
    netRevenue: string;
    taxes: string;
    historicalCost: string;
    marginImpact: string;
    paymentOrSettlement: string;
    reconciles: boolean;
    occurredAt: string;
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
      expiredLotOverrideReason?: string;
      serialNumbers?: string[];
      discount?: SaleDiscountInput;
    }>,
    reservationId?: string,
    customerId?: string,
    discount?: SaleDiscountInput,
  ) {
    return this.http.post<PosCartQuoteResponse>(
      `${this.config.apiBaseUrl()}/pos/cart/quote`,
      {
        lines,
        channel: 'POS',
        ...(reservationId ? { reservationId } : {}),
        ...(customerId ? { customerId } : {}),
        ...(discount ? { discount } : {}),
      },
      { withCredentials: true },
    );
  }

  getPaymentOptions() {
    return this.http.get<{
      data: { methods: CollectedPaymentMethod[]; nonCashProvider: 'SIMULATOR' | 'DISABLED' };
      meta: { apiVersion: '1' };
    }>(`${this.config.apiBaseUrl()}/pos/payment-options`, { withCredentials: true });
  }

  createSale(
    input: {
      lines: Array<{
        productId: string;
        quantity: string;
        lotId?: string;
        expiredLotOverrideReason?: string;
        serialNumbers?: string[];
        discount?: SaleDiscountInput;
      }>;
      discount?: SaleDiscountInput;
      customerId?: string;
      reservationId?: string;
      suspendedSaleId?: string;
      payment?: {
        method: CollectedPaymentMethod;
        amountReceived?: string;
        reference?: string;
      };
      payments?: Array<{
        method: CollectedPaymentMethod;
        amount: string;
        amountReceived?: string;
        reference?: string;
      }>;
      credit?: { installmentCount: number };
    },
    idempotencyKey: string,
  ) {
    return this.http.post<CashSaleResponse>(
      `${this.config.apiBaseUrl()}/pos/sales`,
      { ...input, channel: 'POS' },
      {
        headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
        withCredentials: true,
      },
    );
  }

  listSuspendedSales() {
    return this.http.get<{
      data: SuspendedSaleData[];
      meta: { apiVersion: '1'; expirationHours: number };
    }>(`${this.config.apiBaseUrl()}/pos/suspended-sales`, { withCredentials: true });
  }

  suspendSale(
    input: {
      lines: Array<{
        productId: string;
        quantity: string;
        lotId?: string;
        serialNumbers?: string[];
      }>;
      customerId?: string;
      notes?: string;
    },
    idempotencyKey: string,
  ) {
    return this.http.post<{
      data: SuspendedSaleData;
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>(`${this.config.apiBaseUrl()}/pos/suspended-sales`, input, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
      withCredentials: true,
    });
  }

  resumeSuspendedSale(id: string) {
    return this.http.post<{
      data: {
        suspendedSale: SuspendedSaleData;
        quote: PosCartQuote | null;
        conflicts: SuspendedSaleConflict[];
      };
      meta: { apiVersion: '1'; recalculatedAt: string };
    }>(
      `${this.config.apiBaseUrl()}/pos/suspended-sales/${id}/resume`,
      {},
      { withCredentials: true },
    );
  }

  cancelSuspendedSale(id: string) {
    return this.http.post<{
      data: SuspendedSaleData;
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>(
      `${this.config.apiBaseUrl()}/pos/suspended-sales/${id}/cancel`,
      {},
      { withCredentials: true },
    );
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

  reprintSaleReceipt(id: string) {
    return this.http.post<{
      data: SaleReceiptData;
      meta: { apiVersion: '1' };
    }>(
      `${this.config.apiBaseUrl()}/pos/sales/${id}/receipt/reprints`,
      {},
      { withCredentials: true },
    );
  }

  sendSaleReceipt(id: string, email: string) {
    return this.http.post<{
      data: { receipt: SaleReceiptData; delivery: SaleReceiptDeliveryData };
      meta: { apiVersion: '1' };
    }>(
      `${this.config.apiBaseUrl()}/pos/sales/${id}/receipt/deliveries`,
      { email },
      { withCredentials: true },
    );
  }

  getPeripheralProfile() {
    return this.http.get<{
      data: PosPeripheralProfileData;
      meta: { apiVersion: '1' };
    }>(`${this.config.apiBaseUrl()}/pos/peripherals/profile`, {
      withCredentials: true,
    });
  }

  updatePeripheralProfile(input: {
    deviceId: string;
    label: string;
    adapter: 'SIMULATOR';
    printerEnabled: boolean;
    drawerEnabled: boolean;
    autoOpenCashSale: boolean;
  }) {
    return this.http.put<{
      data: PosPeripheralProfileData;
      meta: { apiVersion: '1' };
    }>(`${this.config.apiBaseUrl()}/pos/peripherals/profile`, input, {
      withCredentials: true,
    });
  }

  printSaleReceipt(id: string, idempotencyKey: string) {
    return this.http.post<{
      data: { receipt: SaleReceiptData; operation: PosPeripheralOperationData };
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>(
      `${this.config.apiBaseUrl()}/pos/peripherals/receipts/${id}/prints`,
      {},
      {
        headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
        withCredentials: true,
      },
    );
  }

  openCashDrawer(
    input: { trigger: 'MANUAL' | 'CASH_SALE_COMPLETED'; saleId?: string },
    idempotencyKey: string,
  ) {
    return this.http.post<{
      data: PosPeripheralOperationData;
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>(`${this.config.apiBaseUrl()}/pos/peripherals/cash-drawer/openings`, input, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
      withCredentials: true,
    });
  }

  listSaleReturns(id: string) {
    return this.http.get<{
      data: SaleReturnData[];
      meta: { apiVersion: '1' };
    }>(`${this.config.apiBaseUrl()}/pos/sales/${id}/returns`, {
      withCredentials: true,
    });
  }

  createSaleReturn(id: string, input: CreateSaleReturnInput, idempotencyKey: string) {
    return this.http.post<{
      data: SaleReturnData;
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>(`${this.config.apiBaseUrl()}/pos/sales/${id}/returns`, input, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
      withCredentials: true,
    });
  }

  settleSaleReturn(
    saleId: string,
    returnId: string,
    input: {
      mode: 'REFUND' | 'STORE_CREDIT';
      amount: string;
      originalPaymentId?: string;
    },
    idempotencyKey: string,
  ) {
    return this.http.post<{
      data: { saleReturn: SaleReturnData; settlement: SaleReturnSettlementData };
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>(`${this.config.apiBaseUrl()}/pos/sales/${saleId}/returns/${returnId}/settlements`, input, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
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

  profitabilityReport(query: {
    dateFrom?: string;
    dateTo?: string;
    branchId?: string;
    cashRegisterId?: string;
    userId?: string;
    page: number;
    pageSize: number;
  }) {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    for (const [key, value] of Object.entries(query)) {
      if (key !== 'page' && key !== 'pageSize' && value) params = params.set(key, value);
    }
    return this.http.get<{
      data: PosProfitabilityReportData;
      meta: {
        apiVersion: '1';
        pagination: { page: number; pageSize: number; total: number; totalPages: number };
        periodTimezone: 'BRANCH_LOCAL';
      };
    }>(`${this.config.apiBaseUrl()}/pos/reports/profitability`, {
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
