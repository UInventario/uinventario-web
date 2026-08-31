import { Observable } from 'rxjs';
import {
  AuditPage,
  AuditQuery,
  CreateDataExportInput,
  DataExportJob,
  DownloadedFile,
} from './control.models';

export abstract class ControlGateway {
  abstract auditEvents(query: AuditQuery): Observable<AuditPage>;
  abstract exportAudit(query: AuditQuery): Observable<DownloadedFile>;
  abstract createExport(input: CreateDataExportInput): Observable<DataExportJob>;
  abstract exportJob(id: string): Observable<DataExportJob>;
  abstract retryExport(id: string): Observable<DataExportJob>;
  abstract downloadExport(id: string): Observable<DownloadedFile>;
}
