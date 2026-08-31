import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PosFacade } from '../../application/pos.facade';
import { PosCartRequest } from '../../domain/pos.models';
import { PosSuspendDialog } from './pos-suspend-dialog';

describe('PosSuspendDialog', () => {
  const facade = { suspendSale: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: PosFacade, useValue: facade }] });
  });

  it('sends only the suspended-sale contract and drops quote-only commercial fields', () => {
    facade.suspendSale.mockReturnValue(
      of({
        id: 'suspended-1',
        status: 'ACTIVE',
        notes: 'Atender después',
        expiresAt: '2026-09-01T00:00:00.000Z',
      }),
    );
    const fixture = TestBed.createComponent(PosSuspendDialog);
    const request: PosCartRequest = {
      channel: 'POS',
      customerId: 'customer-1',
      loyaltyPointsToRedeem: 100,
      discount: { type: 'PERCENT', value: '10', reason: 'Convenio' },
      lines: [{ productId: 'product-1', quantity: '1.000' }],
    };
    fixture.componentRef.setInput('request', request);
    fixture.detectChanges();

    const notes = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    notes.value = 'Atender después';
    notes.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));

    expect(facade.suspendSale).toHaveBeenCalledWith(
      {
        customerId: 'customer-1',
        lines: [{ productId: 'product-1', quantity: '1.000' }],
        notes: 'Atender después',
      },
      expect.stringMatching(/^web-suspend-/),
    );
  });
});
