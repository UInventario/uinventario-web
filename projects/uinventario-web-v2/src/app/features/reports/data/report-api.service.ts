import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../../../core/api/api-client';
import { ApiEnvelope } from '../../../core/api/api-contracts';
import { PagedReport, ReportGateway } from '../domain/report.gateway';
import {
  InventoryActivityReport,
  InventoryMovementRow,
  ProfitabilityReport,
  ReportPagination,
  ReportQuery,
  SaleDetail,
  SaleReturn,
  SalesCashReport,
} from '../domain/report.models';
import { reportApiParams } from './report-api-params';

interface ReportEnvelope<T> extends ApiEnvelope<T> {
  readonly meta: {
    readonly apiVersion: string;
    readonly pagination: ReportPagination;
    readonly periodTimezone?: string;
  };
}

@Injectable()
export class ReportApi extends ReportGateway {
  private readonly api = inject(ApiClient);

  override salesCash(query: ReportQuery) {
    return this.report<SalesCashReport>('/pos/reports/sales-cash', query, 'salesCash');
  }

  override profitability(query: ReportQuery) {
    return this.report<ProfitabilityReport>('/pos/reports/profitability', query, 'profitability');
  }

  override inventoryActivity(query: ReportQuery) {
    return this.report<InventoryActivityReport>('/inventory/reports/activity', query, 'inventory');
  }

  override inventoryMovements(productId: string, query: ReportQuery) {
    return this.report<readonly InventoryMovementRow[]>(
      `/inventory/reports/activity/${encodeURIComponent(productId)}/movements`,
      query,
      'inventoryMovements',
    );
  }

  override sale(id: string) {
    return this.api
      .get<ApiEnvelope<SaleDetail>>(`/pos/reports/sales/${encodeURIComponent(id)}`)
      .pipe(map(({ data }) => data));
  }

  override saleReturns(id: string) {
    return this.api
      .get<ApiEnvelope<readonly SaleReturn[]>>(
        `/pos/reports/sales/${encodeURIComponent(id)}/returns`,
      )
      .pipe(map(({ data }) => data));
  }

  private report<T>(
    path: string,
    query: ReportQuery,
    endpoint: Parameters<typeof reportApiParams>[1],
  ) {
    return this.api.get<ReportEnvelope<T>>(path, { params: reportApiParams(query, endpoint) }).pipe(
      map(
        ({ data, meta }) =>
          ({
            data,
            pagination: meta.pagination,
            periodTimezone: meta.periodTimezone,
          }) satisfies PagedReport<T>,
      ),
    );
  }
}
