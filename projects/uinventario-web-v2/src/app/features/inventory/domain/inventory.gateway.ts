import { Observable } from 'rxjs';
import {
  InventoryLocation,
  InventoryMovement,
  InventoryMovementInput,
  InventoryMovementPage,
  InventoryProductDetails,
  InventoryStateTransitionInput,
  InventoryStockPage,
  MovementQuery,
  StockQuery,
} from './inventory.models';

export abstract class InventoryGateway {
  abstract listStock(query: StockQuery): Observable<InventoryStockPage>;
  abstract listMovements(query: MovementQuery): Observable<InventoryMovementPage>;
  abstract listLocations(): Observable<readonly InventoryLocation[]>;
  abstract getProduct(productId: string): Observable<InventoryProductDetails>;
  abstract createMovement(input: InventoryMovementInput): Observable<InventoryMovement>;
  abstract createStateTransition(
    input: InventoryStateTransitionInput,
  ): Observable<InventoryMovement>;
}
