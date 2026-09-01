import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../../../../core/api/api-runtime-config';
import { ControlApi } from './control-api.service';

describe('ControlApi', () => {
  let api: ControlApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ControlApi,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'https://api.test/api/v1' },
      ],
    });
    api = TestBed.inject(ControlApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends every supported audit filter without unrelated parameters', () => {
    let total = 0;
    api
      .auditEvents({
        q: 'ana@example.com',
        action: 'SALE_COMPLETED',
        entityType: 'SALE',
        actorId: '11111111-1111-4111-8111-111111111111',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
        page: 2,
        pageSize: 25,
      })
      .subscribe((page) => (total = page.pagination.total));

    const request = http.expectOne((candidate) => candidate.url.endsWith('/audit-events'));
    expect(request.request.params.keys().sort()).toEqual([
      'action',
      'actorId',
      'dateFrom',
      'dateTo',
      'entityType',
      'page',
      'pageSize',
      'q',
    ]);
    expect(request.request.params.get('actorId')).toBe('11111111-1111-4111-8111-111111111111');
    request.flush({
      data: [],
      meta: {
        apiVersion: '1',
        pagination: { page: 2, pageSize: 25, total: 31, totalPages: 2 },
        retention: { minimumDays: 365, policy: 'APPEND_ONLY' },
        integrity: { valid: true },
      },
    });
    expect(total).toBe(31);
  });

  it('creates and follows an asynchronous data export', () => {
    const input = { dataset: 'SALES' as const, format: 'XLSX' as const, includeSensitive: false };
    api.createExport(input).subscribe();
    const create = http.expectOne('https://api.test/api/v1/data-exports');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(input);
    create.flush(job('PENDING'));

    api.exportJob('00000000-0000-4000-8000-000000000001').subscribe();
    const status = http.expectOne(
      'https://api.test/api/v1/data-exports/00000000-0000-4000-8000-000000000001',
    );
    expect(status.request.method).toBe('GET');
    status.flush(job('COMPLETED'));
  });

  it('uses the protected download endpoint and server filename', () => {
    let filename = '';
    api
      .downloadExport('00000000-0000-4000-8000-000000000001')
      .subscribe((file) => (filename = file.filename));
    const request = http.expectOne(
      'https://api.test/api/v1/data-exports/00000000-0000-4000-8000-000000000001/download',
    );
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['archivo']), {
      headers: { 'Content-Disposition': 'attachment; filename="sales-2026-08-31.xlsx"' },
    });
    expect(filename).toBe('sales-2026-08-31.xlsx');
  });
});

function job(status: 'PENDING' | 'COMPLETED') {
  return {
    data: {
      id: '00000000-0000-4000-8000-000000000001',
      dataset: 'SALES',
      format: 'XLSX',
      status,
      rowCount: status === 'COMPLETED' ? 4 : null,
      excludedColumns: [],
      errorCode: null,
      expiresAt: '2026-09-01T00:00:00.000Z',
      createdAt: '2026-08-31T00:00:00.000Z',
      completedAt: status === 'COMPLETED' ? '2026-08-31T00:01:00.000Z' : null,
      downloadReady: status === 'COMPLETED',
    },
    meta: { apiVersion: '1' },
  };
}
