import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { ApiClient } from '../../../../core/api/api-client';
import { TraceabilityApi } from './traceability-api.service';

describe('TraceabilityApi', () => {
  const api = { get: vi.fn() };
  let traceability: TraceabilityApi;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [TraceabilityApi, { provide: ApiClient, useValue: api }],
    });
    traceability = TestBed.inject(TraceabilityApi);
  });

  it('preserves authoritative lot totals and expiration metadata', async () => {
    const lot = {
      id: 'lot-1',
      code: 'LOT-2026',
      quantity: '4.000',
      expirationStatus: 'EXPIRING',
    };
    api.get.mockReturnValue(
      of({
        data: [lot],
        meta: {
          apiVersion: '1',
          tracked: true,
          totalQuantity: '4.000',
          lotQuantity: '4.000',
          reconciled: true,
          currency: 'MXN',
          inventoryValue: '200.00',
        },
      }),
    );

    await expect(firstValueFrom(traceability.listLots('product/1'))).resolves.toMatchObject({
      items: [lot],
      tracked: true,
      reconciled: true,
      inventoryValue: '200.00',
    });
    expect(api.get).toHaveBeenCalledWith('/inventory/products/product%2F1/lots');
  });

  it('uses the warehouse-scoped alert and serial history contracts', async () => {
    api.get
      .mockReturnValueOnce(
        of({ data: [{ id: 'alert-1' }], meta: { apiVersion: '1', businessDate: '2026-08-31' } }),
      )
      .mockReturnValueOnce(
        of({ data: { serial: { id: 'serial-1' }, events: [] }, meta: { apiVersion: '1' } }),
      );

    await expect(firstValueFrom(traceability.listExpirationAlerts())).resolves.toEqual({
      items: [{ id: 'alert-1' }],
      businessDate: '2026-08-31',
    });
    await expect(firstValueFrom(traceability.serialHistory('serial/1'))).resolves.toMatchObject({
      serial: { id: 'serial-1' },
      events: [],
    });
    expect(api.get).toHaveBeenNthCalledWith(1, '/inventory/lot-expiration-alerts');
    expect(api.get).toHaveBeenNthCalledWith(2, '/inventory/serials/serial%2F1/history');
  });
});
