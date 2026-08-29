import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';
import type { InventoryMovementType } from './inventory-api.service';

export interface InventoryActivityReportItem {
  product: {
    id: string;
    name: string;
    sku: string;
    category: { id: string; name: string } | null;
  };
  openingQuantity: string;
  closingQuantity: string;
  averageQuantity: string;
  netSoldQuantity: string;
  lossQuantity: string;
  activityQuantity: string;
  rotation: number | null;
  status: 'SLOW' | 'ACTIVE';
  lastMovementAt: string | null;
}

export interface InventoryActivityMovement {
  id: string;
  type: InventoryMovementType;
  quantityChange: string;
  resultingQuantity: string;
  reason: string;
  reference: string | null;
  occurredAt: string;
  branchName: string;
  warehouseName: string;
  locationName: string;
}

export interface InventoryActivityReportData {
  period: { dateFrom: string | null; dateTo: string | null; timezone: 'BRANCH_LOCAL' };
  scope: {
    branches: Array<{ id: string; name: string; timezone: string }>;
    warehouses: Array<{
      id: string;
      name: string;
      branch: { id: string; name: string };
    }>;
  };
  filters: { categories: Array<{ id: string; name: string }> };
  definitions: {
    rotation: string;
    loss: string;
    period: string;
    returnsAndVoids: string;
    transfers: string;
  };
  items: InventoryActivityReportItem[];
  total: number;
}

export interface InventoryActivityReportQuery {
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  warehouseId?: string;
  categoryId?: string;
  product?: string;
  page: number;
  pageSize: number;
}

interface InventoryActivityReportResponse {
  data: InventoryActivityReportData;
  meta: {
    apiVersion: '1';
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  };
}

interface InventoryActivityMovementsResponse {
  data: InventoryActivityMovement[];
  meta: {
    apiVersion: '1';
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  };
}

@Injectable({ providedIn: 'root' })
export class InventoryActivityReportApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  report(query: InventoryActivityReportQuery) {
    return this.http.get<InventoryActivityReportResponse>(
      `${this.config.apiBaseUrl()}/inventory/reports/activity`,
      { params: this.params(query), withCredentials: true },
    );
  }

  movements(
    productId: string,
    query: Omit<InventoryActivityReportQuery, 'categoryId' | 'product'>,
  ) {
    return this.http.get<InventoryActivityMovementsResponse>(
      `${this.config.apiBaseUrl()}/inventory/reports/activity/${productId}/movements`,
      { params: this.params(query), withCredentials: true },
    );
  }

  private params(query: InventoryActivityReportQuery) {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query.dateTo) params = params.set('dateTo', query.dateTo);
    if (query.branchId) params = params.set('branchId', query.branchId);
    if (query.warehouseId) params = params.set('warehouseId', query.warehouseId);
    if (query.categoryId) params = params.set('categoryId', query.categoryId);
    if (query.product) params = params.set('product', query.product);
    return params;
  }
}
