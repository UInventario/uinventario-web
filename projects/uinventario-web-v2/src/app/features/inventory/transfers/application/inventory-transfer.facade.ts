import { Injectable, inject } from '@angular/core';
import { forkJoin } from 'rxjs';
import { InventoryTransferGateway } from '../domain/inventory-transfer.gateway';
import {
  CreateInventoryTransferInput,
  ReceiveInventoryTransferInput,
} from '../domain/inventory-transfer.models';

@Injectable()
export class InventoryTransferFacade {
  private readonly gateway = inject(InventoryTransferGateway);

  bootstrap() {
    return forkJoin({ transfers: this.gateway.list(), branches: this.gateway.branches() });
  }

  list() {
    return this.gateway.list();
  }

  get(id: string) {
    return this.gateway.get(id);
  }

  products(query?: string) {
    return this.gateway.products(query);
  }

  create(input: CreateInventoryTransferInput, key: string) {
    return this.gateway.create(input, key);
  }

  dispatch(id: string, key: string) {
    return this.gateway.dispatch(id, key);
  }

  receive(id: string, input: ReceiveInventoryTransferInput, key: string) {
    return this.gateway.receive(id, input, key);
  }

  cancel(id: string) {
    return this.gateway.cancel(id);
  }
}
