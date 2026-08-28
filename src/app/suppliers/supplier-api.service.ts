import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export interface SupplierContactData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  primary: boolean;
}

export interface SupplierData {
  id: string;
  legalName: string;
  tradeName: string | null;
  countryCode: string;
  identifierType: string;
  taxIdentifier: string;
  active: boolean;
  version: number;
  contacts: SupplierContactData[];
  createdAt: string;
  updatedAt: string;
}

export interface SupplierContactInput {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  primary: boolean;
}

export interface SupplierInput {
  legalName: string;
  tradeName?: string;
  taxIdentifier: string;
  contacts: SupplierContactInput[];
}

interface SupplierResponse {
  data: SupplierData;
  meta: { apiVersion: '1' };
}

export interface SupplierListResponse {
  data: SupplierData[];
  meta: {
    apiVersion: '1';
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  };
}

export type SupplierStatusFilter = 'ACTIVE' | 'INACTIVE' | 'ALL';

@Injectable({ providedIn: 'root' })
export class SupplierApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  list(query: { q?: string; status: SupplierStatusFilter; page: number; pageSize: number }) {
    let params = new HttpParams()
      .set('status', query.status)
      .set('page', query.page)
      .set('pageSize', query.pageSize);
    if (query.q) params = params.set('q', query.q);
    return this.http.get<SupplierListResponse>(`${this.config.apiBaseUrl()}/suppliers`, {
      params,
      withCredentials: true,
    });
  }

  create(input: SupplierInput) {
    return this.http.post<SupplierResponse>(`${this.config.apiBaseUrl()}/suppliers`, input, {
      withCredentials: true,
    });
  }

  update(id: string, input: SupplierInput & { version: number }) {
    return this.http.patch<SupplierResponse>(`${this.config.apiBaseUrl()}/suppliers/${id}`, input, {
      withCredentials: true,
    });
  }

  deactivate(id: string) {
    return this.http.delete<SupplierResponse>(`${this.config.apiBaseUrl()}/suppliers/${id}`, {
      withCredentials: true,
    });
  }
}
