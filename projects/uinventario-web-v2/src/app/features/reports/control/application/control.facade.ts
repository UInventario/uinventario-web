import { Injectable, inject } from '@angular/core';
import { ControlGateway } from '../domain/control.gateway';
import { AuditQuery, CreateDataExportInput } from '../domain/control.models';

@Injectable()
export class ControlFacade {
  private readonly gateway = inject(ControlGateway);

  auditEvents(query: AuditQuery) {
    return this.gateway.auditEvents(query);
  }

  exportAudit(query: AuditQuery) {
    return this.gateway.exportAudit(query);
  }

  createExport(input: CreateDataExportInput) {
    return this.gateway.createExport(input);
  }

  exportJob(id: string) {
    return this.gateway.exportJob(id);
  }

  retryExport(id: string) {
    return this.gateway.retryExport(id);
  }

  downloadExport(id: string) {
    return this.gateway.downloadExport(id);
  }
}
