import { DataExportJob } from '../domain/control.models';
import { dataExportDownloadable, dataExportExpired } from './data-export-policy';

describe('data export download policy', () => {
  const now = Date.parse('2026-08-31T12:00:00.000Z');

  it('allows only completed, ready and unexpired jobs', () => {
    expect(dataExportDownloadable(job('COMPLETED', '2026-09-01T00:00:00.000Z', true), now)).toBe(
      true,
    );
    expect(dataExportDownloadable(job('PROCESSING', '2026-09-01T00:00:00.000Z', false), now)).toBe(
      false,
    );
  });

  it('blocks a stale link even if an old response marked it ready', () => {
    const stale = job('COMPLETED', '2026-08-31T11:59:59.000Z', true);
    expect(dataExportExpired(stale, now)).toBe(true);
    expect(dataExportDownloadable(stale, now)).toBe(false);
  });
});

function job(
  status: DataExportJob['status'],
  expiresAt: string,
  downloadReady: boolean,
): DataExportJob {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    dataset: 'SALES',
    format: 'CSV',
    status,
    rowCount: null,
    excludedColumns: [],
    errorCode: null,
    expiresAt,
    createdAt: '2026-08-31T10:00:00.000Z',
    completedAt: null,
    downloadReady,
  };
}
