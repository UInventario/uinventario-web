import { Injectable, inject } from '@angular/core';
import { SalesOperationsGateway } from '../domain/operations.gateway';
import { OperationLineInput, SalesChannel } from '../domain/operations.models';
import {
  CreateCustomerOrderInput,
  CustomerOrderPriority,
  CustomerOrderStatus,
  OrderTransition,
} from '../domain/order.models';
import { ConvertQuotationInput, QuotationInput, QuotationStatus } from '../domain/quotation.models';
import { CreateReservationInput } from '../domain/reservation.models';

@Injectable()
export class SalesOperationsFacade {
  private readonly gateway = inject(SalesOperationsGateway);

  options() {
    return this.gateway.options();
  }
  quoteCart(input: {
    customerId?: string;
    channel: SalesChannel;
    lines: readonly OperationLineInput[];
  }) {
    return this.gateway.quoteCart(input);
  }
  quotations(status: QuotationStatus | undefined, page: number) {
    return this.gateway.quotations({ status, page, pageSize: 20 });
  }
  createQuotation(input: QuotationInput) {
    return this.gateway.createQuotation(input);
  }
  updateQuotation(id: string, input: QuotationInput, version: number) {
    return this.gateway.updateQuotation(id, input, version);
  }
  previewQuotation(id: string) {
    return this.gateway.previewQuotation(id);
  }
  convertQuotation(id: string, input: ConvertQuotationInput) {
    return this.gateway.convertQuotation(id, input);
  }
  orders(
    status: CustomerOrderStatus | undefined,
    priority: CustomerOrderPriority | undefined,
    page: number,
  ) {
    return this.gateway.orders({ status, priority, page, pageSize: 20 });
  }
  order(id: string) {
    return this.gateway.order(id);
  }
  createOrder(input: CreateCustomerOrderInput) {
    return this.gateway.createOrder(input);
  }
  transitionOrder(id: string, action: OrderTransition, version: number, reason?: string) {
    return this.gateway.transitionOrder(id, action, version, reason);
  }
  shippingContract() {
    return this.gateway.shippingContract();
  }
  quoteShipping(id: string) {
    return this.gateway.quoteShipping(id);
  }
  pollShipping(id: string, scenario: 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'TIMEOUT') {
    return this.gateway.pollShipping(id, scenario);
  }
  cancelShipping(id: string, scenario: 'SUCCESS' | 'TIMEOUT') {
    return this.gateway.cancelShipping(id, scenario);
  }
  reservations() {
    return this.gateway.reservations();
  }
  createReservation(input: CreateReservationInput) {
    return this.gateway.createReservation(input);
  }
  releaseReservation(id: string, reason: string) {
    return this.gateway.releaseReservation(id, reason);
  }
  expireReservations() {
    return this.gateway.expireReservations();
  }
}
