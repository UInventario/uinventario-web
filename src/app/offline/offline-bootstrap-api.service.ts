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

export interface OfflineBootstrapData {
  protocolVersion: '1.0';
  generatedAt: string;
  scope: {
    tenantId: string;
    userId: string;
    deviceId: string;
    branchId: string | null;
    cashRegisterId: string | null;
  };
  page: {
    initialSyncCursor: string;
    cursor: string;
    nextCursor: string | null;
    complete: boolean;
    entities: OfflineBootstrapEntity[];
  };
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
}
