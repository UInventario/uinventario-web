import { Observable } from 'rxjs';
import {
  InventoryActivityReport,
  InventoryMovementRow,
  ProfitabilityReport,
  ReportPagination,
  ReportQuery,
  SaleDetail,
  SaleReturn,
  SalesCashReport,
} from './report.models';

export interface PagedReport<T> {
  readonly data: T;
  readonly pagination: ReportPagination;
  readonly periodTimezone?: string;
}

export abstract class ReportGateway {
  abstract salesCash(query: ReportQuery): Observable<PagedReport<SalesCashReport>>;
  abstract profitability(query: ReportQuery): Observable<PagedReport<ProfitabilityReport>>;
  abstract inventoryActivity(query: ReportQuery): Observable<PagedReport<InventoryActivityReport>>;
  abstract inventoryMovements(
    productId: string,
    query: ReportQuery,
  ): Observable<PagedReport<readonly InventoryMovementRow[]>>;
  abstract sale(id: string): Observable<SaleDetail>;
  abstract saleReturns(id: string): Observable<readonly SaleReturn[]>;
}
