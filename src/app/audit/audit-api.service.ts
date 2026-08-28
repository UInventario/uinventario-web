import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export interface AuditEventData {
  id: string;
  tenantId: string;
  sequence: number;
  action: string;
  entityType: string;
  entityId: string;
  correlationId: string;
  origin: 'APPLICATION' | 'ADMIN_CONSOLE' | 'SYSTEM' | 'INTEGRATION';
  createdAt: string;
  retentionUntil: string;
  actor: { id: string; email: string };
  impersonator: { id: string; email: string } | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  integrity: { valid: boolean; hash: string; previousHash: string };
}

export interface AuditQuery {
  q?: string;
  action?: string;
  entityType?: string;
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}

interface AuditEventsResponse {
  data: AuditEventData[];
  meta: {
    apiVersion: '1';
    retention: { minimumDays: number; policy: 'APPEND_ONLY' };
    integrity: { valid: boolean };
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  };
}

@Injectable({ providedIn: 'root' })
export class AuditApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  list(query: AuditQuery) {
    return this.http.get<AuditEventsResponse>(`${this.config.apiBaseUrl()}/audit-events`, {
      params: this.params(query),
      withCredentials: true,
    });
  }

  export(query: AuditQuery) {
    return this.http.get(`${this.config.apiBaseUrl()}/audit-events/export`, {
      params: this.params(query),
      responseType: 'blob',
      withCredentials: true,
    });
  }

  private params(query: AuditQuery): HttpParams {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.q) params = params.set('q', query.q);
    if (query.action) params = params.set('action', query.action);
    if (query.entityType) params = params.set('entityType', query.entityType);
    if (query.actorId) params = params.set('actorId', query.actorId);
    if (query.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query.dateTo) params = params.set('dateTo', query.dateTo);
    return params;
  }
}
