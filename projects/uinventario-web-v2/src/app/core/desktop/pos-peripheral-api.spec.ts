import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../api/api-client';
import { PosPeripheralApi } from './pos-peripheral-api';

describe('PosPeripheralApi', () => {
  const api = { get: vi.fn(), post: vi.fn() };
  let service: PosPeripheralApi;

  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    TestBed.configureTestingModule({
      providers: [PosPeripheralApi, { provide: ApiClient, useValue: api }],
    });
    service = TestBed.inject(PosPeripheralApi);
  });

  it('loads the authoritative profile for the active cash register', async () => {
    const profile = { id: 'profile-1', deviceId: 'device-1' };
    api.get.mockReturnValue(of({ data: profile, meta: { apiVersion: '1' } }));

    await expect(firstValueFrom(service.profile())).resolves.toBe(profile);
    expect(api.get).toHaveBeenCalledWith('/pos/peripherals/profile');
  });

  it('keeps print and drawer operations idempotent', async () => {
    api.post.mockReturnValue(of({ data: { id: 'operation-1' }, meta: { apiVersion: '1' } }));

    await firstValueFrom(service.printReceipt('sale-1', 'print-operation-1'));
    await firstValueFrom(
      service.openDrawer(
        { trigger: 'CASH_SALE_COMPLETED', saleId: 'sale-1' },
        'drawer-operation-1',
      ),
    );

    expect(api.post).toHaveBeenNthCalledWith(
      1,
      '/pos/peripherals/receipts/sale-1/prints',
      {},
      expect.objectContaining({ headers: expect.any(HttpHeaders) }),
    );
    expect(api.post.mock.calls[0][2].headers.get('Idempotency-Key')).toBe('print-operation-1');
    expect(api.post.mock.calls[1][2].headers.get('Idempotency-Key')).toBe('drawer-operation-1');
  });
});
