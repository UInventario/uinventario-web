import { ReportPagination } from '../../domain/report.models';

export interface AuditQuery {
  readonly q?: string;
  readonly action?: string;
  readonly entityType?: string;
  readonly actorId?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface AuditEvent {
  readonly id: string;
  readonly sequence: number;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly correlationId: string;
  readonly origin: string;
  readonly createdAt: string;
  readonly retentionUntil: string;
  readonly actor: { readonly id: string; readonly email: string };
  readonly impersonator: { readonly id: string; readonly email: string } | null;
  readonly before: Readonly<Record<string, unknown>> | null;
  readonly after: Readonly<Record<string, unknown>> | null;
  readonly integrity: {
    readonly valid: boolean;
    readonly hash: string;
    readonly previousHash: string;
  };
}

export interface AuditPage {
  readonly events: readonly AuditEvent[];
  readonly pagination: ReportPagination;
  readonly retention: { readonly minimumDays: number; readonly policy: 'APPEND_ONLY' };
  readonly integrity: { readonly valid: boolean };
}

export type DataExportDataset = 'PRODUCTS' | 'STOCK' | 'SALES' | 'MOVEMENTS';
export type DataExportFormat = 'CSV' | 'XLSX';
export type DataExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

export interface CreateDataExportInput {
  readonly dataset: DataExportDataset;
  readonly format: DataExportFormat;
  readonly q?: string;
  readonly productStatus?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  readonly saleStatus?: 'COMPLETED' | 'VOIDED' | 'ALL';
  readonly movementType?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly includeSensitive: boolean;
}

export interface DataExportJob {
  readonly id: string;
  readonly dataset: DataExportDataset;
  readonly format: DataExportFormat;
  readonly status: DataExportStatus;
  readonly rowCount: number | null;
  readonly excludedColumns: readonly string[];
  readonly errorCode: string | null;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly completedAt: string | null;
  readonly downloadReady: boolean;
}

export interface DownloadedFile {
  readonly content: Blob;
  readonly filename: string;
}
