import { Observable } from 'rxjs';
import {
  CashRegisterShift,
  CreateCashSaleInput,
  CreatePosSuspendedSaleInput,
  CreateSaleInput,
  PaymentTerminalOperation,
  PosCustomerPage,
  PosLoyaltyStatement,
  PosCartQuote,
  PosCartRequest,
  PosPaymentOptions,
  PosProduct,
  PosProductPage,
  PosSale,
  PosSuspendedSale,
  StartPaymentTerminalInput,
} from './pos.models';

export abstract class PosGateway {
  abstract searchProducts(query: string): Observable<PosProductPage>;
  abstract resolveCode(code: string): Observable<PosProduct>;
  abstract currentShift(): Observable<CashRegisterShift | null>;
  abstract quoteCart(input: PosCartRequest): Observable<PosCartQuote>;
  abstract paymentOptions(): Observable<PosPaymentOptions>;
  abstract searchCustomers(query: string): Observable<PosCustomerPage>;
  abstract loyaltyStatement(customerId: string): Observable<PosLoyaltyStatement>;
  abstract createCashSale(input: CreateCashSaleInput): Observable<PosSale>;
  abstract createSale(input: CreateSaleInput): Observable<PosSale>;
  abstract suspendSale(
    input: CreatePosSuspendedSaleInput,
    idempotencyKey: string,
  ): Observable<PosSuspendedSale>;
  abstract startTerminal(input: StartPaymentTerminalInput): Observable<PaymentTerminalOperation>;
  abstract getTerminal(operationId: string): Observable<PaymentTerminalOperation>;
  abstract cancelTerminal(operationId: string): Observable<PaymentTerminalOperation>;
}
