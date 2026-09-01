import { Observable } from 'rxjs';
import {
  FifoLayerSet,
  ReconciliationRun,
  ValuationMigrationPlan,
  ValuationMethod,
  ValuationPolicy,
  ValuationStockPage,
  ValuationStockQuery,
  ValuedMovementPage,
} from './valuation.models';

export abstract class ValuationGateway {
  abstract policy(): Observable<ValuationPolicy>;
  abstract previewPolicy(method: ValuationMethod): Observable<ValuationMigrationPlan>;
  abstract changePolicy(
    plan: ValuationMigrationPlan,
    idempotencyKey: string,
  ): Observable<ValuationPolicy>;
  abstract stock(query: ValuationStockQuery): Observable<ValuationStockPage>;
  abstract fifoLayers(productId: string): Observable<FifoLayerSet>;
  abstract movements(productId: string, page: number): Observable<ValuedMovementPage>;
  abstract latestReconciliation(): Observable<ReconciliationRun | null>;
  abstract runReconciliation(idempotencyKey: string): Observable<ReconciliationRun>;
}
