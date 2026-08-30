import { HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../../../../core/api/api-client';
import { ApiEnvelope } from '../../../../core/api/api-contracts';
import { PosGateway } from '../domain/pos.gateway';
import {
  CashRegisterShift,
  CreateCashSaleInput,
  CreatePosSuspendedSaleInput,
  CreateSaleInput,
  PaymentTerminalOperation,
  PosCustomer,
  PosCustomerPage,
  PosCartQuote,
  PosCartRequest,
  PosPaymentOptions,
  PosProduct,
  PosProductPage,
  PosSale,
  PosSuspendedSale,
  StartPaymentTerminalInput,
} from '../domain/pos.models';

interface ProductResponse {
  readonly data: readonly PosProduct[];
  readonly meta: { readonly pagination: PosProductPage['pagination'] };
}

interface CustomerResponse {
  readonly data: readonly PosCustomer[];
  readonly meta: { readonly pagination: PosCustomerPage['pagination'] };
}

@Injectable()
export class PosApi extends PosGateway {
  private readonly api = inject(ApiClient);

  override searchProducts(query: string) {
    return this.api
      .get<ProductResponse>('/products', {
        params: {
          q: query,
          status: 'ACTIVE',
          sellableOnly: true,
          page: 1,
          pageSize: 24,
        },
      })
      .pipe(map(({ data, meta }) => ({ products: data, pagination: meta.pagination })));
  }

  override resolveCode(code: string) {
    return this.api
      .get<ApiEnvelope<PosProduct>>('/products/resolve-code', { params: { code } })
      .pipe(map(({ data }) => data));
  }

  override currentShift() {
    return this.api
      .get<ApiEnvelope<CashRegisterShift | null>>('/pos/register-shifts/current')
      .pipe(map(({ data }) => data));
  }

  override quoteCart(input: PosCartRequest) {
    return this.api
      .post<ApiEnvelope<PosCartQuote>, PosCartRequest>('/pos/cart/quote', input)
      .pipe(map(({ data }) => data));
  }

  override paymentOptions() {
    return this.api
      .get<ApiEnvelope<PosPaymentOptions>>('/pos/payment-options')
      .pipe(map(({ data }) => data));
  }

  override searchCustomers(query: string) {
    return this.api
      .get<CustomerResponse>('/customers', {
        params: { q: query, status: 'ACTIVE', page: 1, pageSize: 12 },
      })
      .pipe(map(({ data, meta }) => ({ customers: data, pagination: meta.pagination })));
  }

  override createCashSale(input: CreateCashSaleInput) {
    return this.api
      .post<ApiEnvelope<PosSale>, CreateCashSaleInput>('/pos/sales/cash', input, {
        headers: this.idempotencyHeaders(),
      })
      .pipe(map(({ data }) => data));
  }

  override createSale(input: CreateSaleInput) {
    return this.api
      .post<ApiEnvelope<PosSale>, CreateSaleInput>('/pos/sales', input, {
        headers: this.idempotencyHeaders(),
      })
      .pipe(map(({ data }) => data));
  }

  override suspendSale(input: CreatePosSuspendedSaleInput, idempotencyKey: string) {
    return this.api
      .post<ApiEnvelope<PosSuspendedSale>, CreatePosSuspendedSaleInput>(
        '/pos/suspended-sales',
        input,
        { headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }) },
      )
      .pipe(map(({ data }) => data));
  }

  override startTerminal(input: StartPaymentTerminalInput) {
    return this.api
      .post<ApiEnvelope<PaymentTerminalOperation>, StartPaymentTerminalInput>(
        '/pos/payment-terminal/operations',
        input,
        { headers: this.idempotencyHeaders() },
      )
      .pipe(map(({ data }) => data));
  }

  override getTerminal(operationId: string) {
    return this.api
      .get<ApiEnvelope<PaymentTerminalOperation>>(
        `/pos/payment-terminal/operations/${encodeURIComponent(operationId)}`,
      )
      .pipe(map(({ data }) => data));
  }

  override cancelTerminal(operationId: string) {
    return this.api
      .post<ApiEnvelope<PaymentTerminalOperation>, Record<string, never>>(
        `/pos/payment-terminal/operations/${encodeURIComponent(operationId)}/cancel`,
        {},
      )
      .pipe(map(({ data }) => data));
  }

  private idempotencyHeaders(): HttpHeaders {
    return new HttpHeaders({ 'Idempotency-Key': `web-${crypto.randomUUID()}` });
  }
}
