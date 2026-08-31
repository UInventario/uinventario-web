import { DataExportJob } from '../domain/control.models';

export function dataExportExpired(job: DataExportJob, now = Date.now()): boolean {
  return job.status === 'EXPIRED' || Date.parse(job.expiresAt) <= now;
}

export function dataExportDownloadable(job: DataExportJob, now = Date.now()): boolean {
  return job.downloadReady && job.status === 'COMPLETED' && !dataExportExpired(job, now);
}
