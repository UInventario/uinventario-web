import { Injectable, inject } from '@angular/core';
import { InventoryGateway } from '../domain/inventory.gateway';
import {
  InventoryMovementInput,
  InventoryStateTransitionInput,
  MovementQuery,
  StockQuery,
} from '../domain/inventory.models';

@Injectable()
export class InventoryFacade {
  private readonly gateway = inject(InventoryGateway);

  listStock(query: StockQuery) {
    return this.gateway.listStock(query);
  }

  listMovements(query: MovementQuery) {
    return this.gateway.listMovements(query);
  }

  listLocations() {
    return this.gateway.listLocations();
  }

  getProduct(productId: string) {
    return this.gateway.getProduct(productId);
  }

  createMovement(input: InventoryMovementInput) {
    return this.gateway.createMovement(input);
  }

  createStateTransition(input: InventoryStateTransitionInput) {
    return this.gateway.createStateTransition(input);
  }
}
