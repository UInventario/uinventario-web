import { Observable } from 'rxjs';
import {
  CashRegisterShift,
  CreateCashSaleInput,
  CreateSaleInput,
  PaymentTerminalOperation,
  PosCustomerPage,
  PosCartQuote,
  PosCartRequest,
  PosPaymentOptions,
  PosProduct,
  PosProductPage,
  PosSale,
  StartPaymentTerminalInput,
} from './pos.models';

export abstract class PosGateway {
  abstract searchProducts(query: string): Observable<PosProductPage>;
  abstract resolveCode(code: string): Observable<PosProduct>;
  abstract currentShift(): Observable<CashRegisterShift | null>;
  abstract quoteCart(input: PosCartRequest): Observable<PosCartQuote>;
  abstract paymentOptions(): Observable<PosPaymentOptions>;
  abstract searchCustomers(query: string): Observable<PosCustomerPage>;
  abstract createCashSale(input: CreateCashSaleInput): Observable<PosSale>;
  abstract createSale(input: CreateSaleInput): Observable<PosSale>;
  abstract startTerminal(input: StartPaymentTerminalInput): Observable<PaymentTerminalOperation>;
  abstract getTerminal(operationId: string): Observable<PaymentTerminalOperation>;
  abstract cancelTerminal(operationId: string): Observable<PaymentTerminalOperation>;
}
