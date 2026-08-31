import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PosFacade } from '../../application/pos.facade';
import { PosCustomer, PosSaleTerms } from '../../domain/pos.models';
import { PosBenefitsDialog } from './pos-benefits-dialog';

describe('PosBenefitsDialog', () => {
  const customer: PosCustomer = {
    id: 'customer-1',
    name: 'Cliente preferente',
    identifier: 'CUST-01',
    email: null,
    phone: null,
    active: true,
    privacyStatus: 'ACTIVE',
    credit: null,
  };
  const facade = {
    searchCustomers: vi.fn(),
    loyaltyStatement: vi.fn(() =>
      of({
        customer: { id: customer.id, name: customer.name },
        rule: {
          id: 'rule-1',
          version: 2,
          active: true,
          earnAmount: '100.00',
          earnPoints: 5,
          redeemPoints: 100,
          redeemAmount: '10.00',
          expirationDays: null,
          createdAt: '2026-08-31T00:00:00.000Z',
        },
        balance: 150,
        entries: [],
      }),
    ),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: PosFacade, useValue: facade }] });
  });

  it('requires explicit confirmation and never emits a redemption above the statement balance', () => {
    const fixture = TestBed.createComponent(PosBenefitsDialog);
    fixture.componentRef.setInput('current', { customer } satisfies PosSaleTerms);
    fixture.componentRef.setInput('canDiscount', true);
    let submitted: PosSaleTerms | undefined;
    fixture.componentInstance.submitted.subscribe((value) => (submitted = value));
    fixture.detectChanges();

    setInput(fixture.nativeElement, '[formControlName="loyaltyPoints"]', '100');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(submitted).toBeUndefined();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Confirma un canje',
    );

    setCheck(fixture.nativeElement, '[formControlName="confirmRedemption"]', true);
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    expect(submitted).toMatchObject({ customer, loyaltyPointsToRedeem: 100 });

    submitted = undefined;
    setInput(fixture.nativeElement, '[formControlName="loyaltyPoints"]', '151');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    expect(submitted).toBeUndefined();
  });
});

function setInput(root: HTMLElement, selector: string, value: string): void {
  const input = root.querySelector<HTMLInputElement>(selector)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function setCheck(root: HTMLElement, selector: string, checked: boolean): void {
  const input = root.querySelector<HTMLInputElement>(selector)!;
  input.checked = checked;
  input.dispatchEvent(new Event('change'));
}
