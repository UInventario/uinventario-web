import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  WhatsappApiService,
  WhatsappConsentData,
  WhatsappMessageData,
} from './whatsapp-api.service';
import { WhatsappPanelComponent } from './whatsapp-panel.component';

describe('WhatsappPanelComponent', () => {
  let fixture: ComponentFixture<WhatsappPanelComponent>;
  const optedOut: WhatsappConsentData = {
    customerId: 'customer-1',
    customerName: 'Ada',
    phoneMasked: '***4567',
    status: 'OPTED_OUT',
    changedAt: '2026-08-30T12:00:00.000Z',
  };
  const optedIn: WhatsappConsentData = {
    customerId: 'customer-2',
    customerName: 'Linus',
    phoneMasked: '***9999',
    status: 'OPTED_IN',
    changedAt: '2026-08-30T12:00:00.000Z',
  };
  const sent: WhatsappMessageData = {
    id: 'message-1',
    customer: { id: optedIn.customerId, name: optedIn.customerName },
    template: { key: 'WHATSAPP_SALE_RECEIPT', version: '1' },
    reference: 'SALE-100',
    recipientMasked: '***9999',
    provider: 'SIMULATOR',
    providerReference: 'SIM-111111111111111111111111',
    status: 'SENT',
    errorCode: null,
    lastEventAt: '2026-08-30T12:01:00.000Z',
    createdAt: '2026-08-30T12:01:00.000Z',
    updatedAt: '2026-08-30T12:01:00.000Z',
  };
  const api = {
    contract: vi.fn().mockReturnValue(
      of({
        data: {
          templates: [
            'WHATSAPP_SALE_RECEIPT',
            'WHATSAPP_ORDER_STATUS',
            'WHATSAPP_OPERATIONAL_NOTICE',
          ],
          guarantees: { explicitConsent: true },
        },
        meta: { apiVersion: '1' },
      }),
    ),
    consents: vi.fn().mockReturnValue(of({ data: [optedOut, optedIn], meta: { apiVersion: '1' } })),
    messages: vi.fn().mockReturnValue(of({ data: [], meta: { apiVersion: '1' } })),
    setConsent: vi
      .fn()
      .mockReturnValue(
        of({ data: { ...optedOut, status: 'OPTED_IN' }, meta: { apiVersion: '1' } }),
      ),
    send: vi.fn().mockReturnValue(
      of({
        data: sent,
        meta: {
          apiVersion: '1',
          idempotentReplay: false,
          simulatorWebhookToken: 'token-001',
        },
      }),
    ),
    webhook: vi.fn().mockReturnValue(
      of({
        data: { ...sent, status: 'DELIVERED' },
        meta: { apiVersion: '1', idempotentReplay: false, ignoredOutOfOrder: false },
      }),
    ),
  };

  beforeEach(async () => {
    Object.values(api).forEach((mock) => mock.mockClear());
    await TestBed.configureTestingModule({
      imports: [WhatsappPanelComponent],
      providers: [{ provide: WhatsappApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(WhatsappPanelComponent);
    fixture.detectChanges();
  });

  it('keeps sending disabled for an opted-out customer', () => {
    const article = thisArticle(fixture, 'Ada');
    const send = button(article, 'Enviar plantilla');

    expect(send.disabled).toBe(true);
    expect(article.textContent).toContain('***4567');
    expect(article.textContent).toContain('OPTED_OUT');
  });

  it('registers explicit consent before enabling the channel', () => {
    const article = thisArticle(fixture, 'Ada');
    button(article, 'Registrar consentimiento').click();
    fixture.detectChanges();

    expect(api.setConsent).toHaveBeenCalledWith('customer-1', true);
    expect(thisArticle(fixture, 'Ada').textContent).toContain('OPTED_IN');
    expect(button(thisArticle(fixture, 'Ada'), 'Enviar plantilla').disabled).toBe(false);
  });

  it('sends a fixed template and applies a verified simulator webhook', () => {
    button(thisArticle(fixture, 'Linus'), 'Enviar plantilla').click();
    fixture.detectChanges();

    expect(api.send).toHaveBeenCalledWith(
      'customer-2',
      expect.objectContaining({
        templateKey: 'WHATSAPP_SALE_RECEIPT',
        reference: 'SALE-100',
        scenario: 'SUCCESS',
      }),
    );
    const history = thisArticle(fixture, 'WHATSAPP_SALE_RECEIPT');
    button(history, 'Enviar webhook verificado').click();
    fixture.detectChanges();

    expect(api.webhook).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'token-001',
        providerReference: sent.providerReference,
        status: 'DELIVERED',
      }),
    );
    expect(fixture.nativeElement.textContent).toContain('Webhook verificado y aplicado');
  });
});

function thisArticle(fixture: ComponentFixture<WhatsappPanelComponent>, text: string): HTMLElement {
  return [...fixture.nativeElement.querySelectorAll('article')].find((candidate: HTMLElement) =>
    candidate.textContent?.includes(text),
  ) as HTMLElement;
}

function button(parent: HTMLElement, text: string): HTMLButtonElement {
  return [...parent.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(text),
  ) as HTMLButtonElement;
}
