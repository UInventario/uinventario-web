import { Injectable, inject } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ValuationGateway } from '../domain/valuation.gateway';
import {
  ValuationMigrationPlan,
  ValuationMethod,
  ValuationStockQuery,
} from '../domain/valuation.models';

@Injectable()
export class ValuationFacade {
  private readonly gateway = inject(ValuationGateway);

  context() {
    return forkJoin({
      policy: this.gateway.policy(),
      reconciliation: this.gateway.latestReconciliation(),
    });
  }

  stock(query: ValuationStockQuery) {
    return this.gateway.stock(query);
  }

  product(productId: string, movementPage = 1) {
    return forkJoin({
      layers: this.gateway.fifoLayers(productId),
      movements: this.gateway.movements(productId, movementPage),
    });
  }

  previewPolicy(method: ValuationMethod) {
    return this.gateway.previewPolicy(method);
  }

  changePolicy(plan: ValuationMigrationPlan, idempotencyKey: string) {
    return this.gateway.changePolicy(plan, idempotencyKey);
  }

  runReconciliation(idempotencyKey: string) {
    return this.gateway.runReconciliation(idempotencyKey);
  }
}
