import { Observable } from 'rxjs';
import {
  CatalogProductSearchPage,
  Supplier,
  SupplierInput,
  SupplierPage,
  SupplierProduct,
  SupplierProductInput,
  SupplierProductPage,
  SupplierProductQuery,
  SupplierQuery,
} from './supplier.models';

export abstract class SupplierGateway {
  abstract list(query: SupplierQuery): Observable<SupplierPage>;
  abstract get(id: string): Observable<Supplier>;
  abstract create(input: SupplierInput): Observable<Supplier>;
  abstract update(id: string, input: SupplierInput, version: number): Observable<Supplier>;
  abstract deactivate(id: string): Observable<Supplier>;
  abstract listProducts(query: SupplierProductQuery): Observable<SupplierProductPage>;
  abstract getProduct(id: string): Observable<SupplierProduct>;
  abstract createProduct(input: SupplierProductInput): Observable<SupplierProduct>;
  abstract updateProduct(
    id: string,
    input: SupplierProductInput,
    version: number,
  ): Observable<SupplierProduct>;
  abstract searchCatalogProducts(query: string): Observable<CatalogProductSearchPage>;
}
