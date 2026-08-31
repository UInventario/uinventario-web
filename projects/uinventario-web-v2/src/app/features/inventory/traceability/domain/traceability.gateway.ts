import { Observable } from 'rxjs';
import {
  InventoryLots,
  InventorySerialHistory,
  InventorySerials,
  LotExpirationAlerts,
} from './traceability.models';

export abstract class TraceabilityGateway {
  abstract listLots(productId: string): Observable<InventoryLots>;
  abstract listExpirationAlerts(): Observable<LotExpirationAlerts>;
  abstract listSerials(productId: string): Observable<InventorySerials>;
  abstract serialHistory(serialId: string): Observable<InventorySerialHistory>;
}
