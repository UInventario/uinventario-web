import { Injectable, inject } from '@angular/core';
import { CashGateway } from '../domain/cash.gateway';
import { CashClosureInput, CashMovementInput } from '../domain/cash.models';

@Injectable()
export class CashFacade {
  private readonly gateway = inject(CashGateway);

  currentShift() {
    return this.gateway.currentShift();
  }
  latestClosure() {
    return this.gateway.latestClosure();
  }
  listMovements() {
    return this.gateway.listMovements();
  }
  openShift(openingAmount: string) {
    return this.gateway.openShift(openingAmount);
  }
  createMovement(input: CashMovementInput) {
    return this.gateway.createMovement(input);
  }
  reverseMovement(movementId: string, reason: string) {
    return this.gateway.reverseMovement(movementId, reason);
  }
  closeShift(input: CashClosureInput) {
    return this.gateway.closeShift(input);
  }
}
