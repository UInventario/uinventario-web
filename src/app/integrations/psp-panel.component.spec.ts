import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PspApiService, PspPaymentData } from './psp-api.service';
import { PspPanelComponent } from './psp-panel.component';

describe('PspPanelComponent', () => {
  let fixture: ComponentFixture<PspPanelComponent>;
  const payment: PspPaymentData = {
    id: '11111111-1111-4111-8111-111111111111',
    provider: 'SIMULATOR',
    adapterVersion: '1',
    providerReference: 'PSP-111111111111111111111111',
    merchantReference: 'WEB-1',
    amount: '100.00',
    refundedAmount: '0.00',
    currency: 'MXN',
    status: 'REQUIRES_CONFIRMATION',
    scenario: 'SUCCESS',
    errorCode: null,
    correlationId: 'request-1',
    createdAt: '2026-08-29T12:00:00.000Z',
    updatedAt: '2026-08-29T12:00:00.000Z',
  };
  const api = {
    contract: vi.fn().mockReturnValue(
      of({
        data: {
          name: 'UINVENTARIO_PSP' as const,
          version: '1' as const,
          activeProvider: {
            key: 'SIMULATOR' as const,
            mode: 'SIMULATOR' as const,
            production: false as const,
            requiresCardData: false as const,
          },
          liveProviderProfile: {
            key: 'STRIPE_COMPATIBLE' as const,
            runtimeAvailable: false as const,
            secretReferences: ['API_KEY', 'WEBHOOK_SIGNING_SECRET'],
          },
          operations: ['INTENT', 'CONFIRM', 'CAPTURE', 'QUERY', 'REFUND'],
          guarantees: { cardDataStored: false, webhookVerification: true },
        },
        meta: { apiVersion: '1' as const },
      }),
    ),
    list: vi.fn().mockReturnValue(of({ data: [], meta: {} })),
    create: vi.fn().mockReturnValue(
      of({
        data: payment,
        meta: { idempotentReplay: false, simulatorWebhookToken: 'token-001' },
      }),
    ),
    action: vi.fn().mockReturnValue(of({ data: payment, meta: {} })),
    refund: vi.fn().mockReturnValue(of({ data: payment, meta: {} })),
    webhook: vi.fn().mockReturnValue(
      of({
        data: { ...payment, status: 'CAPTURED' as const },
        meta: { signatureVerified: true, ignoredOutOfOrder: true },
      }),
    ),
  };

  beforeEach(async () => {
    Object.values(api).forEach((mock) => mock.mockClear());
    await TestBed.configureTestingModule({
      imports: [PspPanelComponent],
      providers: [{ provide: PspApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(PspPanelComponent);
    fixture.detectChanges();
  });

  it('exposes the full v1 flow without cardholder inputs', () => {
    const text = fixture.nativeElement.textContent as string;
    ['INTENT', 'CONFIRM', 'CAPTURE', 'QUERY', 'REFUND'].forEach((operation) =>
      expect(text).toContain(operation),
    );
    const names = [...fixture.nativeElement.querySelectorAll('input')].map(
      (input: HTMLInputElement) => input.getAttribute('name') ?? input.type,
    );
    expect(names.join(' ')).not.toMatch(/card|pan|cvc/i);
  });

  it('creates an intent and sends a verified simulator webhook with its one-time token', () => {
    const create = [...fixture.nativeElement.querySelectorAll('button')].find(
      (candidate: HTMLButtonElement) => candidate.textContent?.includes('Crear intención'),
    ) as HTMLButtonElement;
    create.click();
    fixture.detectChanges();

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '100.00', currency: 'MXN', scenario: 'SUCCESS' }),
    );
    const webhook = [...fixture.nativeElement.querySelectorAll('button')].find(
      (candidate: HTMLButtonElement) => candidate.textContent?.includes('Enviar webhook'),
    ) as HTMLButtonElement;
    webhook.click();
    fixture.detectChanges();

    expect(api.webhook).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'token-001',
        providerReference: payment.providerReference,
        status: 'CAPTURED',
      }),
    );
    expect(fixture.nativeElement.textContent).toContain('ignorado por estar fuera de orden');
  });
});
