import { HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, from, map, of, throwError } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { ApiClient } from '../../../../core/api/api-client';
import { ApiEnvelope } from '../../../../core/api/api-contracts';
import { PosGateway } from '../domain/pos.gateway';
import { OfflinePos } from './offline-pos.service';
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
  private readonly offline = inject(OfflinePos);

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
      .pipe(
        map(({ data, meta }) => ({ products: data, pagination: meta.pagination })),
        catchError((error: unknown) =>
          this.fallback(error, () => this.offline.searchProducts(query)),
        ),
      );
  }

  override resolveCode(code: string) {
    return this.api
      .get<ApiEnvelope<PosProduct>>('/products/resolve-code', { params: { code } })
      .pipe(
        map(({ data }) => data),
        catchError((error: unknown) => this.fallback(error, () => this.offline.resolveCode(code))),
      );
  }

  override currentShift() {
    return this.api.get<ApiEnvelope<CashRegisterShift | null>>('/pos/register-shifts/current').pipe(
      map(({ data }) => data),
      catchError((error: unknown) => this.fallback(error, () => this.offline.currentShift())),
    );
  }

  override quoteCart(input: PosCartRequest) {
    return this.api.post<ApiEnvelope<PosCartQuote>, PosCartRequest>('/pos/cart/quote', input).pipe(
      map(({ data }) => data),
      catchError((error: unknown) => this.fallback(error, () => this.offline.quote(input))),
    );
  }

  override paymentOptions() {
    return this.api.get<ApiEnvelope<PosPaymentOptions>>('/pos/payment-options').pipe(
      map(({ data }) => data),
      catchError((error: unknown) =>
        isOfflineFailure(error) ? of(this.offline.paymentOptions()) : throwError(() => error),
      ),
    );
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
      .pipe(
        map(({ data }) => data),
        catchError((error: unknown) =>
          this.fallback(error, () => this.offline.createCashSale(input)),
        ),
      );
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

  private fallback<T>(error: unknown, action: () => Promise<T>) {
    return isOfflineFailure(error) ? from(action()) : throwError(() => error);
  }
}

function isOfflineFailure(error: unknown): boolean {
  return error instanceof ApiError && ['network', 'timeout'].includes(error.kind);
}
