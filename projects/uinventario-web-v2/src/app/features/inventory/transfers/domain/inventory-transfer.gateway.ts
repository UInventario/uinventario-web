import { Observable } from 'rxjs';
import {
  CreateInventoryTransferInput,
  InventoryTransfer,
  ReceiveInventoryTransferInput,
  TransferBranch,
  TransferProduct,
} from './inventory-transfer.models';

export abstract class InventoryTransferGateway {
  abstract list(): Observable<readonly InventoryTransfer[]>;
  abstract get(id: string): Observable<InventoryTransfer>;
  abstract branches(): Observable<readonly TransferBranch[]>;
  abstract products(query?: string): Observable<readonly TransferProduct[]>;
  abstract create(input: CreateInventoryTransferInput, key: string): Observable<InventoryTransfer>;
  abstract dispatch(id: string, key: string): Observable<InventoryTransfer>;
  abstract receive(
    id: string,
    input: ReceiveInventoryTransferInput,
    key: string,
  ): Observable<InventoryTransfer>;
  abstract cancel(id: string): Observable<InventoryTransfer>;
}
