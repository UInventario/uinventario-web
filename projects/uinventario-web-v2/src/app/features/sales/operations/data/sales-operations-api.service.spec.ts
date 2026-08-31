import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { ApiClient } from '../../../../core/api/api-client';
import { CreateCustomerOrderInput } from '../domain/order.models';
import { SalesOperationsApi } from './sales-operations-api.service';

describe('SalesOperationsApi', () => {
  const client = { get: vi.fn(), post: vi.fn(), put: vi.fn() };
  let api: SalesOperationsApi;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [SalesOperationsApi, { provide: ApiClient, useValue: client }],
    });
    api = TestBed.inject(SalesOperationsApi);
  });

  it('sends only active order filters and maps pagination', async () => {
    client.get.mockReturnValue(
      of({
        data: [],
        meta: { pagination: { page: 2, pageSize: 20, total: 24, totalPages: 2 } },
      }),
    );

    const result = await firstValueFrom(api.orders({ status: 'READY', page: 2, pageSize: 20 }));

    expect(client.get).toHaveBeenCalledWith('/orders', {
      params: { status: 'READY', page: 2, pageSize: 20 },
    });
    expect(result.pagination.total).toBe(24);
  });

  it('uses real inventory availability in operation product options', async () => {
    client.get.mockImplementation((path: string) => {
      if (path === '/customers') return of({ data: [] });
      if (path === '/products') {
        return of({
          data: [
            {
              id: 'product-1',
              name: 'Café',
              sku: 'CAF-01',
              minimumQuantity: '1',
              quantityPrecision: 0,
            },
          ],
        });
      }
      if (path === '/inventory/stock') {
        return of({ data: [{ product: { id: 'product-1' }, availableQuantity: '7.000' }] });
      }
      if (path === '/inventory/locations') return of({ data: [] });
      return of({ data: { methods: ['CASH'] } });
    });

    const options = await firstValueFrom(api.options());

    expect(options.products[0]?.availableQuantity).toBe('7.000');
    expect(client.get).toHaveBeenCalledWith('/inventory/stock', {
      params: { page: 1, pageSize: 100 },
    });
  });

  it('creates a quoted order with an isolated idempotency key', async () => {
    const input = orderInput();
    const order = { id: 'order-1', orderNumber: 'PED-001' };
    client.post.mockReturnValue(of({ data: order }));

    await expect(firstValueFrom(api.createOrder(input))).resolves.toBe(order);
    const [path, body, options] = client.post.mock.calls[0] as [
      string,
      CreateCustomerOrderInput,
      { headers: HttpHeaders },
    ];
    expect(path).toBe('/orders');
    expect(body.lines[0]?.quantity).toBe('0.250');
    expect(options.headers.get('Idempotency-Key')).toMatch(/^web-[0-9a-f-]{36}$/);
  });

  it('uses the current version and reason for order transitions', async () => {
    client.post.mockReturnValue(of({ data: { id: 'order-1', version: 8 } }));

    await firstValueFrom(api.transitionOrder('order/1', 'cancel', 7, 'Cliente desistió'));

    const [path, body, options] = client.post.mock.calls[0] as [
      string,
      { version: number; reason: string },
      { headers: HttpHeaders },
    ];
    expect(path).toBe('/orders/order%2F1/cancel');
    expect(body).toEqual({ version: 7, reason: 'Cliente desistió' });
    expect(options.headers.has('Idempotency-Key')).toBe(true);
  });

  it('uses separate shipping endpoints for quote, tracking, and cancellation', async () => {
    client.post.mockReturnValue(of({ data: {} }));

    await firstValueFrom(api.quoteShipping('order-1'));
    await firstValueFrom(api.pollShipping('order-1', 'DELIVERED'));
    await firstValueFrom(api.cancelShipping('order-1', 'TIMEOUT'));

    expect(client.post.mock.calls[0]?.slice(0, 2)).toEqual([
      '/shipping/v1/orders/order-1/quote',
      {},
    ]);
    expect(client.post.mock.calls[1]?.slice(0, 2)).toEqual([
      '/shipping/v1/orders/order-1/poll',
      { scenario: 'DELIVERED' },
    ]);
    expect(client.post.mock.calls[2]?.slice(0, 2)).toEqual([
      '/shipping/v1/orders/order-1/cancel',
      { scenario: 'TIMEOUT' },
    ]);
  });
});

function orderInput(): CreateCustomerOrderInput {
  return {
    channel: 'WEB',
    customerId: 'customer-1',
    locationId: 'location-1',
    priority: 'NORMAL',
    expiresInHours: 48,
    fulfillment: {
      method: 'PICKUP',
      windowStart: '2026-08-31T12:00:00.000Z',
      windowEnd: '2026-08-31T14:00:00.000Z',
      deliveryCost: '0.00',
    },
    lines: [{ productId: 'product-1', quantity: '0.250' }],
    payments: [{ method: 'CASH', amountReceived: '100.00' }],
  };
}
