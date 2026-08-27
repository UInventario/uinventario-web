import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export interface AuditEventData {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  correlationId: string;
  createdAt: string;
  actor: { id: string; email: string };
}

interface AuditEventsResponse {
  data: AuditEventData[];
  meta: {
    apiVersion: '1';
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  };
}

@Injectable({ providedIn: 'root' })
export class AuditApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  list(page = 1, pageSize = 20) {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<AuditEventsResponse>(`${this.config.apiBaseUrl()}/audit-events`, {
      params,
      withCredentials: true,
    });
  }
}
