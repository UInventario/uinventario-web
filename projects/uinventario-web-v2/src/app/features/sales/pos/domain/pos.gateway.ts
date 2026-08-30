import { Observable } from 'rxjs';
import {
  CashRegisterShift,
  PosCartQuote,
  PosCartRequest,
  PosProduct,
  PosProductPage,
} from './pos.models';

export abstract class PosGateway {
  abstract searchProducts(query: string): Observable<PosProductPage>;
  abstract resolveCode(code: string): Observable<PosProduct>;
  abstract currentShift(): Observable<CashRegisterShift | null>;
  abstract quoteCart(input: PosCartRequest): Observable<PosCartQuote>;
}
