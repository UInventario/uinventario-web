import { Injectable, inject } from '@angular/core';
import { PosGateway } from '../domain/pos.gateway';
import { PosCartRequest } from '../domain/pos.models';

@Injectable()
export class PosFacade {
  private readonly gateway = inject(PosGateway);

  searchProducts(query: string) {
    return this.gateway.searchProducts(query);
  }
  resolveCode(code: string) {
    return this.gateway.resolveCode(code);
  }
  currentShift() {
    return this.gateway.currentShift();
  }
  quoteCart(input: PosCartRequest) {
    return this.gateway.quoteCart(input);
  }
}
