import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CommerceApiService, CommerceCredentialData } from './commerce-api.service';
import { CommerceIntegrationPanelComponent } from './commerce-integration-panel.component';

describe('CommerceIntegrationPanelComponent', () => {
  let fixture: ComponentFixture<CommerceIntegrationPanelComponent>;
  const credential: CommerceCredentialData = {
    id: 'credential-1',
    name: 'Marketplace',
    keyPrefix: 'prefix',
    scopes: ['CATALOG_READ', 'STOCK_READ', 'ORDERS_WRITE', 'ORDERS_READ'],
    context: {
      branch: { id: 'branch-1', name: 'Central' },
      warehouse: { id: 'warehouse-1', name: 'General' },
      cashRegister: { id: 'register-1', name: 'Caja', code: 'C1' },
      location: { id: 'location-1', name: 'Piso', code: 'P1' },
      customer: { id: 'customer-1', name: 'Cliente API' },
    },
    active: true,
    rateLimitPerMinute: 60,
    webhook: {
      url: 'https://retry.example.test/webhook',
      events: ['ORDER_CONFIRMED'],
      enabled: true,
      mode: 'SIMULATOR',
    },
    lastUsedAt: null,
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
  };
  const api = {
    openapi: vi.fn(() =>
      of({
        openapi: '3.1.0' as const,
        info: { title: 'UInventario External Commerce API', version: '1.0.0' },
        servers: [{ url: '/external/v1' }],
        paths: {
          '/catalog': {
            get: {
              summary: 'Catálogo incremental',
              'x-required-scope': 'CATALOG_READ' as const,
              responses: { '200': { description: 'Página incremental de catálogo' } },
            },
          },
        },
        'x-webhook-contract': {
          version: '1' as const,
          signatureHeader: 'X-UInventario-Signature',
          signature: 'HMAC-SHA256(JSON, SHA256(apiKey))',
          attempts: { automatic: 3, controlledMaximumTotal: 5 },
        },
      }),
    ),
    credentials: vi.fn(() => of({ data: [credential], meta: { apiVersion: '1' as const } })),
    deliveries: vi.fn(() =>
      of({
        data: [
          {
            id: 'delivery-1',
            eventId: 'event-1',
            eventType: 'ORDER_CONFIRMED' as const,
            targetUrl: 'https://retry.example.test/webhook',
            signature: `sha256=${'a'.repeat(64)}`,
            status: 'SUCCEEDED' as const,
            attemptCount: 2,
            errorCode: null,
            createdAt: '2026-08-30T00:00:00.000Z',
            updatedAt: '2026-08-30T00:00:01.000Z',
            deliveredAt: '2026-08-30T00:00:01.000Z',
          },
          {
            id: 'delivery-2',
            eventId: 'event-2',
            eventType: 'ORDER_READY' as const,
            targetUrl: 'https://retry.example.test/webhook',
            signature: `sha256=${'b'.repeat(64)}`,
            status: 'RETRYABLE_FAILURE' as const,
            attemptCount: 3,
            errorCode: 'SIMULATED_TIMEOUT',
            createdAt: '2026-08-30T00:00:00.000Z',
            updatedAt: '2026-08-30T00:00:01.000Z',
            deliveredAt: null,
          },
        ],
        meta: { apiVersion: '1' as const },
      }),
    ),
    create: vi.fn(() =>
      of({
        data: { ...credential, apiKey: `uic_12345678_${'s'.repeat(43)}` },
        meta: { apiVersion: '1' as const, warning: 'visible una vez' },
      }),
    ),
    revoke: vi.fn(() =>
      of({ data: { revoked: true as const }, meta: { apiVersion: '1' as const } }),
    ),
    rotate: vi.fn(() =>
      of({
        data: {
          ...credential,
          keyPrefix: 'uic_87654321',
          apiKey: `uic_87654321_${'r'.repeat(43)}`,
        },
        meta: { apiVersion: '1' as const, warning: 'visible una vez' },
      }),
    ),
    replay: vi.fn(() =>
      of({
        data: {
          id: 'delivery-2',
          eventId: 'event-2',
          eventType: 'ORDER_READY' as const,
          targetUrl: 'https://retry.example.test/webhook',
          signature: `sha256=${'c'.repeat(64)}`,
          status: 'SUCCEEDED' as const,
          attemptCount: 4,
          errorCode: null,
          createdAt: '2026-08-30T00:00:00.000Z',
          updatedAt: '2026-08-30T00:00:02.000Z',
          deliveredAt: '2026-08-30T00:00:02.000Z',
        },
        meta: { apiVersion: '1' as const },
      }),
    ),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [CommerceIntegrationPanelComponent],
      providers: [{ provide: CommerceApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(CommerceIntegrationPanelComponent);
    fixture.componentRef.setInput('session', {
      user: { id: 'user-1', email: 'admin@example.test', roles: ['ADMIN'], permissions: [] },
      tenant: { id: 'tenant-1', name: 'Empresa' },
      context: {
        branch: { id: 'branch-1', name: 'Central' },
        warehouse: { id: 'warehouse-1', name: 'General' },
        cashRegister: { id: 'register-1', name: 'Caja', code: 'C1' },
      },
      nextStep: 'APPLICATION',
    });
    fixture.componentRef.setInput('locations', [{ id: 'location-1', name: 'Piso', code: 'P1' }]);
    fixture.componentRef.setInput('customers', [
      {
        id: 'customer-1',
        name: 'Cliente API',
        identifier: null,
        email: null,
        phone: null,
        dataProcessingConsent: false,
        privacyStatus: 'ACTIVE',
        anonymizedAt: null,
        privacyRetentionUntil: null,
        active: true,
        version: 1,
        createdAt: '2026-08-30T00:00:00.000Z',
        updatedAt: '2026-08-30T00:00:00.000Z',
      },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('shows credential scope and observable webhook delivery state', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Marketplace');
    expect(text).toContain('CATALOG_READ');
    expect(text).toContain('ORDER_CONFIRMED');
    expect(text).toContain('SUCCEEDED');
    expect(text).toContain('OpenAPI 3.1.0');
  });

  it('emits the current context and shows the raw key only after creation', () => {
    const component = fixture.componentInstance as never as {
      form: { controls: { name: { setValue(value: string): void } } };
      submit(): void;
    };
    component.form.controls.name.setValue('Nueva tienda');
    component.submit();
    fixture.detectChanges();

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Nueva tienda',
        branchId: 'branch-1',
        warehouseId: 'warehouse-1',
        cashRegisterId: 'register-1',
        locationId: 'location-1',
        customerId: 'customer-1',
      }),
    );
    expect(fixture.nativeElement.textContent as string).toContain('Clave visible una sola vez');
    expect(fixture.nativeElement.textContent as string).toContain('uic_12345678_');
  });

  it('rotates the credential and reveals only the new key', () => {
    const rotate = [...fixture.nativeElement.querySelectorAll('button')].find(
      (candidate: HTMLButtonElement) => candidate.textContent?.includes('Rotar'),
    ) as HTMLButtonElement;
    rotate.click();
    fixture.detectChanges();

    expect(api.rotate).toHaveBeenCalledWith(credential.id);
    expect(fixture.nativeElement.textContent).toContain('uic_87654321_');
    expect(fixture.nativeElement.textContent).toContain('clave anterior dejó de funcionar');
  });

  it('allows a controlled replay only for a retryable delivery', () => {
    const replay = [...fixture.nativeElement.querySelectorAll('button')].find(
      (candidate: HTMLButtonElement) => candidate.textContent?.includes('Reintentar entrega'),
    ) as HTMLButtonElement;
    replay.click();
    fixture.detectChanges();

    expect(api.replay).toHaveBeenCalledWith('delivery-2');
    expect(fixture.nativeElement.textContent).toContain('Replay controlado completado: SUCCEEDED');
  });
});
