import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export interface OfflineBootstrapEntity {
  kind: string;
  id: string;
  tenantId: string;
  version: number;
  updatedAt: string;
}

export interface OfflineFreshnessPolicyData {
  version: 1;
  maxClockSkewSeconds: number;
  catalogTtlSeconds: number;
  permissionsTtlSeconds: number;
  actionTtlSeconds: {
    CASH_SALE: number;
    INVENTORY_COUNT: number;
    INVENTORY_MOVEMENT: number;
  };
}

export interface OfflinePosPolicyData extends OfflineBootstrapEntity {
  kind: 'POS_POLICY';
  branchId: string;
  warehouseId: string;
  cashRegisterId: string;
  shiftId: string;
  shiftOpenedAt: string;
  currency: string;
  taxRate: string;
  paymentMethods: ['CASH'];
  negativeStock: 'DENY';
}

export interface OfflineBootstrapData {
  protocolVersion: '1.0';
  generatedAt: string;
  sessionExpiresAt: string;
  freshnessPolicy: OfflineFreshnessPolicyData;
  scope: {
    tenantId: string;
    userId: string;
    deviceId: string;
    branchId: string | null;
    cashRegisterId: string | null;
  };
  posPolicy?: OfflinePosPolicyData | null;
  identity: {
    tenant: { id: string; name: string };
    user: { id: string; roles: string[]; permissions: string[] };
  };
  page: {
    initialSyncCursor: string;
    cursor: string;
    nextCursor: string | null;
    complete: boolean;
    entities: OfflineBootstrapEntity[];
  };
}

export interface OfflineChange {
  changeId: string;
  operation: 'UPSERT' | 'DELETE';
  occurredAt: string;
  entity: OfflineBootstrapEntity;
}

export interface OfflineChangesData {
  protocolVersion: '1.0';
  generatedAt: string;
  sessionExpiresAt: string;
  freshnessPolicy: OfflineFreshnessPolicyData;
  scope: OfflineBootstrapData['scope'];
  identity: {
    user: { id: string; roles: string[]; permissions: string[] };
  };
  cursor: string;
  nextCursor: string;
  hasMore: boolean;
  changes: OfflineChange[];
}

interface OfflineBootstrapResponse {
  data: OfflineBootstrapData;
}

@Injectable({ providedIn: 'root' })
export class OfflineBootstrapApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  page(deviceId: string, cursor?: string, pageSize = 100) {
    let params = new HttpParams().set('deviceId', deviceId).set('pageSize', pageSize);
    if (cursor) params = params.set('cursor', cursor);
    return this.http.get<OfflineBootstrapResponse>(
      `${this.config.apiBaseUrl()}/offline/bootstrap`,
      { params, withCredentials: true },
    );
  }

  changes(deviceId: string, cursor: string, pageSize = 100) {
    const params = new HttpParams()
      .set('deviceId', deviceId)
      .set('cursor', cursor)
      .set('pageSize', pageSize);
    return this.http.get<{ data: OfflineChangesData }>(
      `${this.config.apiBaseUrl()}/offline/changes`,
      { params, withCredentials: true },
    );
  }
}
