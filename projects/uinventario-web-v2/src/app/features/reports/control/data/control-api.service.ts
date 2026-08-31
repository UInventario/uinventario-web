import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../../../../core/api/api-client';
import { ApiEnvelope } from '../../../../core/api/api-contracts';
import { API_BASE_URL } from '../../../../core/api/api-runtime-config';
import { ControlGateway } from '../domain/control.gateway';
import {
  AuditEvent,
  AuditPage,
  AuditQuery,
  CreateDataExportInput,
  DataExportJob,
  DownloadedFile,
} from '../domain/control.models';

interface AuditEnvelope {
  readonly data: readonly AuditEvent[];
  readonly meta: Omit<AuditPage, 'events'> & { readonly apiVersion: '1' };
}

@Injectable()
export class ControlApi extends ControlGateway {
  private readonly api = inject(ApiClient);
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  override auditEvents(query: AuditQuery) {
    return this.api.get<AuditEnvelope>('/audit-events', { params: auditApiParams(query) }).pipe(
      map(({ data, meta }) => ({
        events: data,
        pagination: meta.pagination,
        retention: meta.retention,
        integrity: meta.integrity,
      })),
    );
  }

  override exportAudit(query: AuditQuery) {
    return this.download('/audit-events/export', 'auditoria.csv', auditApiParams(query));
  }

  override createExport(input: CreateDataExportInput) {
    return this.api
      .post<ApiEnvelope<DataExportJob>, CreateDataExportInput>('/data-exports', input)
      .pipe(map(({ data }) => data));
  }

  override exportJob(id: string) {
    return this.api
      .get<ApiEnvelope<DataExportJob>>(`/data-exports/${encodeURIComponent(id)}`)
      .pipe(map(({ data }) => data));
  }

  override retryExport(id: string) {
    return this.api
      .post<ApiEnvelope<DataExportJob>, Record<string, never>>(
        `/data-exports/${encodeURIComponent(id)}/retry`,
        {},
      )
      .pipe(map(({ data }) => data));
  }

  override downloadExport(id: string) {
    return this.download(`/data-exports/${encodeURIComponent(id)}/download`, 'exportacion');
  }

  private download(path: string, fallbackName: string, params?: Record<string, string | number>) {
    return this.http
      .get(`${this.apiBaseUrl}${path}`, { observe: 'response', params, responseType: 'blob' })
      .pipe(map((response) => downloadedFile(response, fallbackName)));
  }
}

export function auditApiParams(query: AuditQuery): Record<string, string | number> {
  const params: Record<string, string | number> = { page: query.page, pageSize: query.pageSize };
  for (const key of ['q', 'action', 'entityType', 'actorId', 'dateFrom', 'dateTo'] as const) {
    if (query[key]) params[key] = query[key];
  }
  return params;
}

function downloadedFile(response: HttpResponse<Blob>, fallbackName: string): DownloadedFile {
  const content = response.body ?? new Blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const simple = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
  let filename: string;
  try {
    filename = encoded ? decodeURIComponent(encoded) : (simple ?? fallbackName);
  } catch {
    filename = simple ?? fallbackName;
  }
  return { content, filename };
}
