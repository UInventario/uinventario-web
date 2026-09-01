import { HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { forkJoin, map } from 'rxjs';
import { ApiClient } from '../../../../core/api/api-client';
import { ApiEnvelope } from '../../../../core/api/api-contracts';
import { SalesOperationsGateway } from '../domain/operations.gateway';
import {
  CartQuote,
  CustomerOption,
  LocationOption,
  OperationOptions,
  ProductOption,
} from '../domain/operations.models';
import {
  CreateCustomerOrderInput,
  CustomerOrder,
  CustomerOrderPage,
  OrderTransition,
  ShippingContract,
  ShippingQuote,
} from '../domain/order.models';
import {
  ConvertQuotationInput,
  QuotationConversion,
  QuotationInput,
  QuotationPreview,
  SalesQuotation,
} from '../domain/quotation.models';
import { CreateReservationInput, ProductReservation } from '../domain/reservation.models';

interface ListEnvelope<T> {
  readonly data: readonly T[];
  readonly meta: { readonly pagination: CustomerOrderPage['pagination'] };
}

type CatalogProduct = Omit<ProductOption, 'availableQuantity'>;

interface StockEnvelope {
  readonly data: readonly {
    readonly product: { readonly id: string };
    readonly availableQuantity: string;
  }[];
}

@Injectable()
export class SalesOperationsApi extends SalesOperationsGateway {
  private readonly api = inject(ApiClient);

  override options() {
    return forkJoin({
      customers: this.api.get<ListEnvelope<CustomerOption>>('/customers', {
        params: { status: 'ACTIVE', page: 1, pageSize: 100 },
      }),
      products: this.api.get<ListEnvelope<CatalogProduct>>('/products', {
        params: { status: 'ACTIVE', sellableOnly: true, page: 1, pageSize: 100 },
      }),
      stock: this.api.get<StockEnvelope>('/inventory/stock', {
        params: { page: 1, pageSize: 100 },
      }),
      locations: this.api.get<ApiEnvelope<readonly LocationOption[]>>('/inventory/locations'),
      payments:
        this.api.get<ApiEnvelope<{ readonly methods: OperationOptions['paymentMethods'] }>>(
          '/pos/payment-options',
        ),
    }).pipe(
      map(({ customers, products, stock, locations, payments }) => {
        const available = new Map(
          stock.data.map((item) => [item.product.id, item.availableQuantity]),
        );
        return {
          customers: customers.data,
          products: products.data.map((product) => ({
            ...product,
            availableQuantity: available.get(product.id) ?? '0.000',
          })),
          locations: locations.data,
          paymentMethods: payments.data.methods,
        };
      }),
    );
  }

  override quoteCart(input: Parameters<SalesOperationsGateway['quoteCart']>[0]) {
    return this.api
      .post<ApiEnvelope<CartQuote>, typeof input>('/pos/cart/quote', input)
      .pipe(map(({ data }) => data));
  }

  override quotations(query: Parameters<SalesOperationsGateway['quotations']>[0]) {
    return this.api
      .get<ListEnvelope<SalesQuotation>>('/quotations', { params: compact(query) })
      .pipe(map(({ data, meta }) => ({ quotations: data, pagination: meta.pagination })));
  }

  override createQuotation(input: QuotationInput) {
    return this.api
      .post<ApiEnvelope<SalesQuotation>, QuotationInput>('/quotations', input, this.key())
      .pipe(map(({ data }) => data));
  }

  override updateQuotation(id: string, input: QuotationInput, version: number) {
    return this.api
      .put<ApiEnvelope<SalesQuotation>, QuotationInput & { readonly version: number }>(
        `/quotations/${encodeURIComponent(id)}`,
        { ...input, version },
        this.key(),
      )
      .pipe(map(({ data }) => data));
  }

  override previewQuotation(id: string) {
    return this.api
      .post<ApiEnvelope<QuotationPreview>, Record<string, never>>(
        `/quotations/${encodeURIComponent(id)}/preview`,
        {},
      )
      .pipe(map(({ data }) => data));
  }

  override convertQuotation(id: string, input: ConvertQuotationInput) {
    return this.api
      .post<ApiEnvelope<QuotationConversion>, ConvertQuotationInput>(
        `/quotations/${encodeURIComponent(id)}/convert`,
        input,
        this.key(),
      )
      .pipe(map(({ data }) => data));
  }

  override orders(query: Parameters<SalesOperationsGateway['orders']>[0]) {
    return this.api
      .get<ListEnvelope<CustomerOrder>>('/orders', { params: compact(query) })
      .pipe(map(({ data, meta }) => ({ orders: data, pagination: meta.pagination })));
  }

  override order(id: string) {
    return this.api
      .get<ApiEnvelope<CustomerOrder>>(`/orders/${encodeURIComponent(id)}`)
      .pipe(map(({ data }) => data));
  }

  override createOrder(input: CreateCustomerOrderInput) {
    return this.api
      .post<ApiEnvelope<CustomerOrder>, CreateCustomerOrderInput>('/orders', input, this.key())
      .pipe(map(({ data }) => data));
  }

  override transitionOrder(id: string, action: OrderTransition, version: number, reason?: string) {
    return this.api
      .post<ApiEnvelope<CustomerOrder>, { readonly version: number; readonly reason?: string }>(
        `/orders/${encodeURIComponent(id)}/${action}`,
        { version, ...(reason ? { reason } : {}) },
        this.key(),
      )
      .pipe(map(({ data }) => data));
  }

  override shippingContract() {
    return this.api
      .get<ApiEnvelope<ShippingContract>>('/shipping/v1/contract')
      .pipe(map(({ data }) => data));
  }

  override quoteShipping(id: string) {
    return this.api
      .post<ApiEnvelope<ShippingQuote>, Record<string, never>>(
        `/shipping/v1/orders/${encodeURIComponent(id)}/quote`,
        {},
      )
      .pipe(map(({ data }) => data));
  }

  override pollShipping(
    id: string,
    scenario: 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'TIMEOUT',
  ) {
    return this.shippingAction(id, 'poll', { scenario });
  }

  override cancelShipping(id: string, scenario: 'SUCCESS' | 'TIMEOUT') {
    return this.shippingAction(id, 'cancel', { scenario });
  }

  override reservations() {
    return this.api
      .get<ApiEnvelope<readonly ProductReservation[]>>('/reservations')
      .pipe(map(({ data }) => data));
  }

  override createReservation(input: CreateReservationInput) {
    return this.api
      .post<ApiEnvelope<ProductReservation>, CreateReservationInput>(
        '/reservations',
        input,
        this.key(),
      )
      .pipe(map(({ data }) => data));
  }

  override releaseReservation(id: string, reason: string) {
    return this.api
      .post<ApiEnvelope<ProductReservation>, { readonly reason: string }>(
        `/reservations/${encodeURIComponent(id)}/release`,
        { reason },
        this.key(),
      )
      .pipe(map(({ data }) => data));
  }

  override expireReservations() {
    return this.api
      .post<ApiEnvelope<readonly ProductReservation[]>, Record<string, never>>(
        '/reservations/expire-due',
        {},
      )
      .pipe(map(({ data }) => data));
  }

  private shippingAction(
    id: string,
    action: 'poll' | 'cancel',
    body: { readonly scenario: string },
  ) {
    return this.api
      .post<ApiEnvelope<CustomerOrder>, typeof body>(
        `/shipping/v1/orders/${encodeURIComponent(id)}/${action}`,
        body,
        this.key(),
      )
      .pipe(map(({ data }) => data));
  }

  private key() {
    return { headers: new HttpHeaders({ 'Idempotency-Key': `web-${crypto.randomUUID()}` }) };
  }
}

function compact<T extends object>(source: T): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(source).filter(
      (entry): entry is [string, string | number] => entry[1] !== undefined,
    ),
  );
}
