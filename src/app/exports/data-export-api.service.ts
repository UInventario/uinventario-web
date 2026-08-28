import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export type DataExportDataset = 'PRODUCTS' | 'STOCK' | 'SALES' | 'MOVEMENTS';
export type DataExportFormat = 'CSV' | 'XLSX';
export type DataExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

export interface DataExportRequest {
  dataset: DataExportDataset;
  format: DataExportFormat;
  q?: string;
  productStatus?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  saleStatus?: 'COMPLETED' | 'VOIDED' | 'ALL';
  dateFrom?: string;
  dateTo?: string;
  includeSensitive?: boolean;
}

export interface DataExportData {
  id: string;
  dataset: DataExportDataset;
  format: DataExportFormat;
  status: DataExportStatus;
  rowCount: number | null;
  excludedColumns: string[];
  errorCode: string | null;
  expiresAt: string;
  createdAt: string;
  completedAt: string | null;
  downloadReady: boolean;
}

interface DataExportResponse {
  data: DataExportData;
  meta: { apiVersion: '1' };
}

@Injectable({ providedIn: 'root' })
export class DataExportApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  create(input: DataExportRequest) {
    return this.http.post<DataExportResponse>(`${this.config.apiBaseUrl()}/data-exports`, input, {
      withCredentials: true,
    });
  }

  get(id: string) {
    return this.http.get<DataExportResponse>(`${this.config.apiBaseUrl()}/data-exports/${id}`, {
      withCredentials: true,
    });
  }

  retry(id: string) {
    return this.http.post<DataExportResponse>(
      `${this.config.apiBaseUrl()}/data-exports/${id}/retry`,
      {},
      { withCredentials: true },
    );
  }

  download(id: string) {
    return this.http.get(`${this.config.apiBaseUrl()}/data-exports/${id}/download`, {
      responseType: 'blob',
      withCredentials: true,
    });
  }
}
