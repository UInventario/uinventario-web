import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { CommerceGateway } from '../domain/commerce.gateway';
import { CommerceContract } from '../domain/commerce.models';
import { CommerceFacade } from './commerce.facade';

describe('CommerceFacade', () => {
  const gateway = {
    credentials: vi.fn(),
    deliveries: vi.fn(),
    contract: vi.fn(),
    options: vi.fn(),
    create: vi.fn(),
    rotate: vi.fn(),
    revoke: vi.fn(),
    replay: vi.fn(),
  };
  let facade: CommerceFacade;

  beforeEach(() => {
    vi.clearAllMocks();
    gateway.credentials.mockReturnValue(of([]));
    gateway.deliveries.mockReturnValue(throwError(() => new Error('offline')));
    gateway.contract.mockReturnValue(of({ paths: {} }));
    gateway.options.mockReturnValue(of({ contexts: [], customers: [] }));
    TestBed.configureTestingModule({
      providers: [CommerceFacade, { provide: CommerceGateway, useValue: gateway }],
    });
    facade = TestBed.inject(CommerceFacade);
  });

  it('keeps channels and the contract available when delivery synchronization fails', async () => {
    const snapshot = await firstValueFrom(facade.load());

    expect(snapshot.credentials).toEqual({ data: [], error: null });
    expect(snapshot.deliveries).toEqual({
      data: null,
      error: 'No fue posible consultar esta fuente.',
    });
    expect(snapshot.contract.data).not.toBeNull();
  });

  it('documents GET and external order creation as idempotent operations', () => {
    const contract = {
      paths: {
        '/catalog': {
          get: { summary: 'Catálogo incremental', 'x-required-scope': 'CATALOG_READ' },
        },
        '/orders': {
          post: { summary: 'Crear pedido idempotente', 'x-required-scope': 'ORDERS_WRITE' },
        },
      },
    } as unknown as CommerceContract;

    expect(facade.operations(contract)).toEqual([
      expect.objectContaining({ method: 'GET', path: '/catalog', idempotent: true }),
      expect.objectContaining({ method: 'POST', path: '/orders', idempotent: true }),
    ]);
  });
});
