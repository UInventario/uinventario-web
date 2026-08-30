import { Injectable, inject } from '@angular/core';
import { forkJoin } from 'rxjs';
import { InventoryOperationsGateway } from '../domain/inventory-operations.gateway';
import {
  AlertQuery,
  CountSessionInput,
  ImportMode,
  StockAlert,
} from '../domain/inventory-operations.models';

@Injectable()
export class InventoryOperationsFacade {
  private readonly gateway = inject(InventoryOperationsGateway);

  countsContext() {
    return forkJoin({ sessions: this.gateway.listCounts(), locations: this.gateway.locations() });
  }
  products(q?: string) {
    return this.gateway.products(q);
  }
  getCount(id: string) {
    return this.gateway.getCount(id);
  }
  createCount(input: CountSessionInput, key: string) {
    return this.gateway.createCount(input, key);
  }
  recordCount(id: string, productId: string, quantity: string, attempt: number) {
    return this.gateway.recordCount(id, productId, quantity, attempt);
  }
  closeCount(id: string, reason: string, reference: string) {
    return this.gateway.closeCount(id, reason, reference);
  }
  previewImport(file: File, mode: ImportMode) {
    return this.gateway.previewImport(file, mode);
  }
  confirmImport(id: string, key: string) {
    return this.gateway.confirmImport(id, key);
  }
  alerts(query: AlertQuery) {
    return this.gateway.alerts(query);
  }
  setThreshold(alert: StockAlert, threshold: string) {
    return this.gateway.setThreshold(alert, threshold);
  }
}
