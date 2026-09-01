import { Observable } from 'rxjs';
import {
  AlertPage,
  AlertQuery,
  CountSession,
  CountSessionInput,
  ImportMode,
  InventoryImport,
  LocationOption,
  ProductOption,
  StockAlert,
} from './inventory-operations.models';

export abstract class InventoryOperationsGateway {
  abstract listCounts(): Observable<readonly CountSession[]>;
  abstract getCount(id: string): Observable<CountSession>;
  abstract createCount(input: CountSessionInput, key: string): Observable<CountSession>;
  abstract recordCount(
    sessionId: string,
    productId: string,
    countedQuantity: string,
    expectedAttempt: number,
  ): Observable<CountSession>;
  abstract closeCount(
    sessionId: string,
    reason: string,
    reference: string,
  ): Observable<CountSession>;
  abstract locations(): Observable<readonly LocationOption[]>;
  abstract products(q?: string): Observable<readonly ProductOption[]>;
  abstract previewImport(file: File, mode: ImportMode): Observable<InventoryImport>;
  abstract confirmImport(importId: string, key: string): Observable<InventoryImport>;
  abstract alerts(query: AlertQuery): Observable<AlertPage>;
  abstract setThreshold(alert: StockAlert, threshold: string): Observable<StockAlert>;
}
