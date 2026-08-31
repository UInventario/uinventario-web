import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { ApiClient } from '../../../core/api/api-client';
import { ApiError } from '../../../core/api/api-error';
import { InventoryApi } from './inventory-api.service';

describe('InventoryApi', () => {
  const api = {
    get: vi.fn(),
    post: vi.fn(),
  };
  let inventory: InventoryApi;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [InventoryApi, { provide: ApiClient, useValue: api }],
    });
    inventory = TestBed.inject(InventoryApi);
  });

  it('maps stock envelope metadata without deriving stock or money in the client', async () => {
    const item = {
      product: {
        id: '10000000-0000-4000-8000-000000000001',
        name: 'Café',
        sku: 'CAFE-01',
        active: true,
        trackLots: false,
        baseUnit: 'KILOGRAM',
        quantityPrecision: 3,
        minimumQuantity: '0.001',
      },
      availableQuantity: '4.250',
      totalQuantity: '5.000',
      states: [],
      averageUnitCost: '82.40',
      inventoryValue: '412.00',
      costing: { method: 'WEIGHTED_AVERAGE', currency: 'MXN', reconciled: true },
    };
    const pagination = { page: 2, pageSize: 20, total: 25, totalPages: 2 };
    const scope = {
      branch: { id: '20000000-0000-4000-8000-000000000001', name: 'Centro' },
      warehouse: { id: '30000000-0000-4000-8000-000000000001', name: 'Principal' },
    };
    api.get.mockReturnValue(
      of({ data: [item], meta: { scope, valuation: { currency: 'MXN' }, pagination } }),
    );

    await expect(
      firstValueFrom(inventory.listStock({ q: ' café ', page: 2, pageSize: 20 })),
    ).resolves.toEqual({ items: [item], scope, currency: 'MXN', pagination });
    expect(api.get).toHaveBeenCalledWith('/inventory/stock', {
      params: { q: ' café ', page: 2, pageSize: 20 },
    });
  });

  it('sends mutations with an isolated idempotency key and preserves decimal strings', async () => {
    const input = {
      productId: '10000000-0000-4000-8000-000000000001',
      locationId: '40000000-0000-4000-8000-000000000001',
      type: 'ENTRY' as const,
      quantity: '0.250',
      reason: 'Recepción manual',
      reference: 'REC-25',
    };
    const movement = { id: '50000000-0000-4000-8000-000000000001' };
    api.post.mockReturnValue(of({ data: movement, meta: { apiVersion: '1' } }));

    await expect(firstValueFrom(inventory.createMovement(input))).resolves.toBe(movement);
    const [, body, options] = api.post.mock.calls[0] as [
      string,
      typeof input,
      { headers: HttpHeaders },
    ];
    expect(body.quantity).toBe('0.250');
    expect(options.headers.get('Idempotency-Key')).toMatch(/^web-[0-9a-f-]{36}$/);
  });

  it('propagates normalized API failures for the component to render', async () => {
    const failure = new ApiError(
      'conflict',
      'El saldo cambió.',
      409,
      'INVENTORY_VERSION_CONFLICT',
      'request-1',
      true,
    );
    api.get.mockReturnValue(throwError(() => failure));

    await expect(firstValueFrom(inventory.listMovements({ page: 1, pageSize: 20 }))).rejects.toBe(
      failure,
    );
  });
});
