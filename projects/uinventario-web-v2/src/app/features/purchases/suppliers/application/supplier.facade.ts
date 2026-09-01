import { Injectable, inject } from '@angular/core';
import { SupplierGateway } from '../domain/supplier.gateway';
import {
  Supplier,
  SupplierInput,
  SupplierProduct,
  SupplierProductInput,
  SupplierProductQuery,
  SupplierQuery,
} from '../domain/supplier.models';

@Injectable()
export class SupplierFacade {
  private readonly gateway = inject(SupplierGateway);

  list(query: SupplierQuery) {
    return this.gateway.list(query);
  }

  get(id: string) {
    return this.gateway.get(id);
  }

  save(input: SupplierInput, supplier?: Supplier) {
    return supplier
      ? this.gateway.update(supplier.id, input, supplier.version)
      : this.gateway.create(input);
  }

  deactivate(id: string) {
    return this.gateway.deactivate(id);
  }

  listProducts(query: SupplierProductQuery) {
    return this.gateway.listProducts(query);
  }

  getProduct(id: string) {
    return this.gateway.getProduct(id);
  }

  saveProduct(input: SupplierProductInput, link?: SupplierProduct) {
    return link
      ? this.gateway.updateProduct(link.id, input, link.version)
      : this.gateway.createProduct(input);
  }

  searchCatalogProducts(query: string) {
    return this.gateway.searchCatalogProducts(query);
  }
}
