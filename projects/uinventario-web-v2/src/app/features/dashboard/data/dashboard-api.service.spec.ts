import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { ApiClient } from '../../../core/api/api-client';
import { ApiError } from '../../../core/api/api-error';
import { DashboardApi } from './dashboard-api.service';

describe('DashboardApi', () => {
  const api = { get: vi.fn(), post: vi.fn(), put: vi.fn() };
  let dashboard: DashboardApi;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [DashboardApi, { provide: ApiClient, useValue: api }],
    });
    dashboard = TestBed.inject(DashboardApi);
  });

  it('requests only aggregate-sized dashboard payloads', async () => {
    api.get
      .mockReturnValueOnce(
        of({
          data: {
            summary: {
              sales: { completed: 3, net: '125.00' },
              reconciliation: { matches: true },
            },
          },
        }),
      )
      .mockReturnValueOnce(of({ data: [], meta: { pagination: { total: 4 } } }))
      .mockReturnValueOnce(of({ data: [], meta: { pagination: { total: 7 } } }));

    await expect(
      firstValueFrom(dashboard.sales({ dateFrom: '2026-08-01', dateTo: '2026-08-30' }, 'branch-1')),
    ).resolves.toEqual({ net: '125.00', completed: 3, paymentsMatch: true });
    await expect(firstValueFrom(dashboard.stockAlertTotal('LOW'))).resolves.toBe(4);
    await expect(firstValueFrom(dashboard.purchaseTotal())).resolves.toBe(7);

    expect(api.get).toHaveBeenNthCalledWith(1, '/pos/reports/sales-cash', {
      params: {
        dateFrom: '2026-08-01',
        dateTo: '2026-08-30',
        branchId: 'branch-1',
        status: 'ALL',
        page: 1,
        pageSize: 1,
      },
    });
    expect(api.get).toHaveBeenNthCalledWith(2, '/inventory/stock-alerts', {
      params: { status: 'LOW', page: 1, pageSize: 1 },
    });
    expect(api.get).toHaveBeenNthCalledWith(3, '/purchase-orders', {
      params: { page: 1, pageSize: 1 },
    });
  });

  it('treats a missing latest forecast as an empty first-run state', async () => {
    api.get.mockReturnValue(
      throwError(
        () => new ApiError('unknown', 'No encontrado', 404, 'HTTP_404', 'request-1', false),
      ),
    );
    await expect(firstValueFrom(dashboard.latestForecast())).resolves.toBeNull();
  });

  it('generates forecasts with a unique idempotency key', async () => {
    const forecast = { id: 'forecast-1', horizonDays: 14 };
    api.post.mockReturnValue(of({ data: forecast }));

    await expect(firstValueFrom(dashboard.generateForecast(14))).resolves.toBe(forecast);
    const [, body, options] = api.post.mock.calls[0] as [
      string,
      { horizonDays: number },
      { headers: HttpHeaders },
    ];
    expect(body).toEqual({ horizonDays: 14 });
    expect(options.headers.get('Idempotency-Key')).toMatch(/^web-forecast-[0-9a-f-]{36}$/);
  });

  it('sends inbox filters without requesting unrelated management data', async () => {
    api.get.mockReturnValue(of({ data: [], meta: { unread: 2, pagination: { total: 5 } } }));
    await expect(firstValueFrom(dashboard.notifications(true, 'STOCK_LOW'))).resolves.toEqual({
      items: [],
      unread: 2,
      total: 5,
    });
    expect(api.get).toHaveBeenCalledOnce();
    expect(api.get).toHaveBeenCalledWith('/notifications', {
      params: { unreadOnly: true, eventType: 'STOCK_LOW', page: 1, pageSize: 50 },
    });
  });
});
