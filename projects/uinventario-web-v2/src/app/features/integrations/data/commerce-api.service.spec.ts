import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { ApiClient } from '../../../core/api/api-client';
import { CommerceApi } from './commerce-api.service';

describe('CommerceApi', () => {
  const api = { get: vi.fn(), post: vi.fn(), delete: vi.fn() };
  let commerce: CommerceApi;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [CommerceApi, { provide: ApiClient, useValue: api }],
    });
    commerce = TestBed.inject(CommerceApi);
  });

  it('uses a unique idempotency key and separates the one-time secret from the credential', async () => {
    api.post.mockReturnValue(
      of({
        data: {
          id: 'credential-1',
          name: 'Marketplace',
          keyPrefix: 'uic_abcd1234',
          apiKey: 'uic_abcd1234_one-time-secret',
        },
      }),
    );
    const input = {
      name: 'Marketplace',
      scopes: ['CATALOG_READ' as const],
      branchId: 'branch-1',
      warehouseId: 'warehouse-1',
      cashRegisterId: 'register-1',
      locationId: 'location-1',
      customerId: 'customer-1',
      rateLimitPerMinute: 60,
      webhookEvents: [],
      webhookEnabled: false,
    };

    const issued = await firstValueFrom(commerce.create(input));

    expect(issued.oneTimeApiKey).toBe('uic_abcd1234_one-time-secret');
    expect(issued.credential).not.toHaveProperty('apiKey');
    expect(api.post).toHaveBeenCalledWith(
      '/integrations/commerce/credentials',
      input,
      expect.objectContaining({
        headers: expect.objectContaining({
          'Idempotency-Key': expect.stringMatching(/^commerce-create-[0-9a-f-]{36}$/),
        }),
      }),
    );
  });
});
