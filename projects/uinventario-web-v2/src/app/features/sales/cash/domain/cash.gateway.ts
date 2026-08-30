import { Observable } from 'rxjs';
import {
  CashClosure,
  CashClosureInput,
  CashMovement,
  CashMovementInput,
  CashMovementList,
  CashShift,
} from './cash.models';

export abstract class CashGateway {
  abstract currentShift(): Observable<CashShift | null>;
  abstract latestClosure(): Observable<CashClosure | null>;
  abstract listMovements(): Observable<CashMovementList>;
  abstract openShift(openingAmount: string): Observable<CashShift>;
  abstract createMovement(input: CashMovementInput): Observable<CashMovement>;
  abstract reverseMovement(movementId: string, reason: string): Observable<CashMovement>;
  abstract closeShift(input: CashClosureInput): Observable<CashClosure>;
}
