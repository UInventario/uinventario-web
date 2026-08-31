import { Observable } from 'rxjs';
import { CartQuote, OperationLineInput, OperationOptions, SalesChannel } from './operations.models';
import {
  CreateCustomerOrderInput,
  CustomerOrder,
  CustomerOrderPage,
  CustomerOrderPriority,
  CustomerOrderStatus,
  OrderTransition,
  ShippingContract,
  ShippingQuote,
} from './order.models';
import {
  ConvertQuotationInput,
  QuotationConversion,
  QuotationInput,
  QuotationPage,
  QuotationPreview,
  QuotationStatus,
  SalesQuotation,
} from './quotation.models';
import { CreateReservationInput, ProductReservation } from './reservation.models';

export abstract class SalesOperationsGateway {
  abstract options(): Observable<OperationOptions>;
  abstract quoteCart(input: {
    readonly customerId?: string;
    readonly channel: SalesChannel;
    readonly lines: readonly OperationLineInput[];
  }): Observable<CartQuote>;

  abstract quotations(query: {
    readonly status?: QuotationStatus;
    readonly page: number;
    readonly pageSize: number;
  }): Observable<QuotationPage>;
  abstract createQuotation(input: QuotationInput): Observable<SalesQuotation>;
  abstract updateQuotation(
    id: string,
    input: QuotationInput,
    version: number,
  ): Observable<SalesQuotation>;
  abstract previewQuotation(id: string): Observable<QuotationPreview>;
  abstract convertQuotation(
    id: string,
    input: ConvertQuotationInput,
  ): Observable<QuotationConversion>;

  abstract orders(query: {
    readonly status?: CustomerOrderStatus;
    readonly priority?: CustomerOrderPriority;
    readonly page: number;
    readonly pageSize: number;
  }): Observable<CustomerOrderPage>;
  abstract order(id: string): Observable<CustomerOrder>;
  abstract createOrder(input: CreateCustomerOrderInput): Observable<CustomerOrder>;
  abstract transitionOrder(
    id: string,
    action: OrderTransition,
    version: number,
    reason?: string,
  ): Observable<CustomerOrder>;
  abstract shippingContract(): Observable<ShippingContract>;
  abstract quoteShipping(id: string): Observable<ShippingQuote>;
  abstract pollShipping(
    id: string,
    scenario: 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'TIMEOUT',
  ): Observable<CustomerOrder>;
  abstract cancelShipping(id: string, scenario: 'SUCCESS' | 'TIMEOUT'): Observable<CustomerOrder>;

  abstract reservations(): Observable<readonly ProductReservation[]>;
  abstract createReservation(input: CreateReservationInput): Observable<ProductReservation>;
  abstract releaseReservation(id: string, reason: string): Observable<ProductReservation>;
  abstract expireReservations(): Observable<readonly ProductReservation[]>;
}
