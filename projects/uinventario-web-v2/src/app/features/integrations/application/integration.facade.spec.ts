import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { IntegrationGateway } from '../domain/integration.gateway';
import { ProviderKey, ProviderSummary } from '../domain/integration.models';
import { IntegrationFacade } from './integration.facade';

describe('IntegrationFacade', () => {
  const gateway = {
    adapters: vi.fn(),
    executions: vi.fn(),
    emailEvents: vi.fn(),
    provider: vi.fn(),
    updateAdapter: vi.fn(),
    diagnose: vi.fn(),
  };
  let facade: IntegrationFacade;

  beforeEach(() => {
    vi.clearAllMocks();
    gateway.adapters.mockReturnValue(of({ configurations: [], catalog: [] }));
    gateway.executions.mockReturnValue(of([]));
    gateway.emailEvents.mockReturnValue(of([]));
    gateway.provider.mockImplementation((key: ProviderKey) =>
      key === 'erp'
        ? throwError(() => new Error('offline'))
        : of({
            key,
            label: key,
            contractVersion: '1',
            mode: 'SIMULATOR',
            health: 'HEALTHY',
            activityCount: 0,
            errorCount: 0,
            detail: 'Disponible',
          } satisfies ProviderSummary),
    );
    TestBed.configureTestingModule({
      providers: [IntegrationFacade, { provide: IntegrationGateway, useValue: gateway }],
    });
    facade = TestBed.inject(IntegrationFacade);
  });

  it('isolates a provider outage while preserving every other console source', async () => {
    const snapshot = await firstValueFrom(facade.load());

    expect(snapshot.adapters.error).toBeNull();
    expect(snapshot.providers).toHaveLength(5);
    expect(snapshot.providers[1]).toEqual({ data: null, error: 'El proveedor no respondió.' });
    expect(snapshot.providers.filter(({ data }) => data)).toHaveLength(4);
  });

  it('normalizes adapter configuration without accepting an empty secret reference', () => {
    gateway.updateAdapter.mockReturnValue(of({}));

    facade
      .updateAdapter({
        capability: 'NOTIFICATION_EMAIL',
        countryCode: ' mx ',
        provider: ' simulator ',
        adapterVersion: ' 1 ',
        enabled: false,
        timeoutMs: 5000,
        maxAttempts: 3,
        secretReference: '  ',
      })
      .subscribe();

    expect(gateway.updateAdapter).toHaveBeenCalledWith({
      capability: 'NOTIFICATION_EMAIL',
      countryCode: 'MX',
      provider: 'simulator',
      adapterVersion: '1',
      enabled: false,
      timeoutMs: 5000,
      maxAttempts: 3,
      secretReference: null,
    });
  });
});
