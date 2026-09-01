import { Observable } from 'rxjs';
import {
  PurchaseOrder,
  PurchaseOrderInput,
  PurchaseOrderPage,
  PurchaseOrderQuery,
  PurchaseReceiptInput,
  PurchaseReturnInput,
  ReceiptLocation,
  SupplierOption,
  SupplierProductOption,
} from './procurement.models';

export abstract class ProcurementGateway {
  abstract list(query: PurchaseOrderQuery): Observable<PurchaseOrderPage>;
  abstract get(id: string): Observable<PurchaseOrder>;
  abstract create(input: PurchaseOrderInput): Observable<PurchaseOrder>;
  abstract update(
    id: string,
    input: PurchaseOrderInput,
    version: number,
  ): Observable<PurchaseOrder>;
  abstract approve(
    id: string,
    version: number,
    idempotencyKey: string,
    reason?: string,
  ): Observable<PurchaseOrder>;
  abstract send(id: string, version: number, idempotencyKey: string): Observable<PurchaseOrder>;
  abstract cancel(
    id: string,
    version: number,
    reason: string,
    idempotencyKey: string,
  ): Observable<PurchaseOrder>;
  abstract receive(
    id: string,
    input: PurchaseReceiptInput,
    idempotencyKey: string,
  ): Observable<PurchaseOrder>;
  abstract returnToSupplier(
    id: string,
    input: PurchaseReturnInput,
    idempotencyKey: string,
  ): Observable<PurchaseOrder>;
  abstract listSuppliers(): Observable<readonly SupplierOption[]>;
  abstract listSupplierProducts(supplierId: string): Observable<readonly SupplierProductOption[]>;
  abstract listLocations(): Observable<readonly ReceiptLocation[]>;
}
