import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export interface CustomerData {
  id: string;
  name: string;
  identifier: string | null;
  email: string | null;
  phone: string | null;
  dataProcessingConsent: boolean;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerInput {
  name: string;
  identifier?: string;
  email?: string;
  phone?: string;
  dataProcessingConsent: boolean;
  active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class CustomerApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  list(query: {
    q?: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
    page: number;
    pageSize: number;
  }) {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.q) params = params.set('q', query.q);
    if (query.status) params = params.set('status', query.status);
    return this.http.get<{
      data: CustomerData[];
      meta: { apiVersion: '1'; pagination: { total: number; totalPages: number } };
    }>(`${this.config.apiBaseUrl()}/customers`, { params, withCredentials: true });
  }

  create(input: CustomerInput) {
    return this.http.post<{ data: CustomerData; meta: { apiVersion: '1' } }>(
      `${this.config.apiBaseUrl()}/customers`,
      input,
      { withCredentials: true },
    );
  }

  update(id: string, input: CustomerInput & { version: number }) {
    return this.http.patch<{ data: CustomerData; meta: { apiVersion: '1' } }>(
      `${this.config.apiBaseUrl()}/customers/${id}`,
      input,
      { withCredentials: true },
    );
  }

  deactivate(id: string) {
    return this.http.delete<{ data: CustomerData; meta: { apiVersion: '1' } }>(
      `${this.config.apiBaseUrl()}/customers/${id}`,
      { withCredentials: true },
    );
  }
}
