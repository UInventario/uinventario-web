import { Injectable, inject } from '@angular/core';
import { ProcurementGateway } from '../domain/procurement.gateway';
import {
  PurchaseOrder,
  PurchaseOrderInput,
  PurchaseOrderQuery,
  PurchaseReceiptInput,
  PurchaseReturnInput,
  PurchaseTransitionAction,
} from '../domain/procurement.models';

@Injectable()
export class ProcurementFacade {
  private readonly gateway = inject(ProcurementGateway);

  list(query: PurchaseOrderQuery) {
    return this.gateway.list(query);
  }

  get(id: string) {
    return this.gateway.get(id);
  }

  save(input: PurchaseOrderInput, order?: PurchaseOrder) {
    return order ? this.gateway.update(order.id, input, order.version) : this.gateway.create(input);
  }

  transition(
    order: PurchaseOrder,
    action: PurchaseTransitionAction,
    idempotencyKey: string,
    reason?: string,
  ) {
    if (action === 'APPROVE')
      return this.gateway.approve(order.id, order.version, idempotencyKey, reason);
    if (action === 'SEND') return this.gateway.send(order.id, order.version, idempotencyKey);
    return this.gateway.cancel(order.id, order.version, reason ?? '', idempotencyKey);
  }

  receive(order: PurchaseOrder, input: PurchaseReceiptInput, idempotencyKey: string) {
    return this.gateway.receive(order.id, input, idempotencyKey);
  }

  returnToSupplier(order: PurchaseOrder, input: PurchaseReturnInput, idempotencyKey: string) {
    return this.gateway.returnToSupplier(order.id, input, idempotencyKey);
  }

  listSuppliers() {
    return this.gateway.listSuppliers();
  }

  listSupplierProducts(supplierId: string) {
    return this.gateway.listSupplierProducts(supplierId);
  }

  listLocations() {
    return this.gateway.listLocations();
  }
}
