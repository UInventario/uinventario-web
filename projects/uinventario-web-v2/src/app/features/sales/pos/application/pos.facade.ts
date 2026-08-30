import { Injectable, inject } from '@angular/core';
import { PosGateway } from '../domain/pos.gateway';
import {
  CreateCashSaleInput,
  CreatePosSuspendedSaleInput,
  CreateSaleInput,
  PosCartRequest,
  StartPaymentTerminalInput,
} from '../domain/pos.models';

@Injectable()
export class PosFacade {
  private readonly gateway = inject(PosGateway);

  searchProducts(query: string) {
    return this.gateway.searchProducts(query);
  }
  resolveCode(code: string) {
    return this.gateway.resolveCode(code);
  }
  currentShift() {
    return this.gateway.currentShift();
  }
  quoteCart(input: PosCartRequest) {
    return this.gateway.quoteCart(input);
  }
  paymentOptions() {
    return this.gateway.paymentOptions();
  }
  searchCustomers(query: string) {
    return this.gateway.searchCustomers(query);
  }
  createCashSale(input: CreateCashSaleInput) {
    return this.gateway.createCashSale(input);
  }
  createSale(input: CreateSaleInput) {
    return this.gateway.createSale(input);
  }
  suspendSale(input: CreatePosSuspendedSaleInput, idempotencyKey: string) {
    return this.gateway.suspendSale(input, idempotencyKey);
  }
  startTerminal(input: StartPaymentTerminalInput) {
    return this.gateway.startTerminal(input);
  }
  getTerminal(operationId: string) {
    return this.gateway.getTerminal(operationId);
  }
  cancelTerminal(operationId: string) {
    return this.gateway.cancelTerminal(operationId);
  }
}
