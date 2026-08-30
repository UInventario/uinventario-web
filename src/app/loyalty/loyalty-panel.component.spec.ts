import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CustomerApiService } from '../customers/customer-api.service';
import { LoyaltyApiService, LoyaltyRuleData } from './loyalty-api.service';
import { LoyaltyPanelComponent } from './loyalty-panel.component';

describe('LoyaltyPanelComponent', () => {
  let fixture: ComponentFixture<LoyaltyPanelComponent>;
  const rule: LoyaltyRuleData = {
    id: 'rule-1',
    version: 2,
    active: true,
    earnAmount: '1.00',
    earnPoints: 1,
    redeemPoints: 100,
    redeemAmount: '1.00',
    expirationDays: 365,
    createdAt: '2026-08-29T00:00:00.000Z',
  };
  const loyalty = {
    currentRule: vi.fn(() => of({ data: rule, meta: { apiVersion: '1' as const } })),
    saveRule: vi.fn(() =>
      of({ data: { ...rule, version: 3 }, meta: { apiVersion: '1' as const } }),
    ),
    statement: vi.fn(() =>
      of({
        data: {
          customer: { id: 'customer-1', name: 'Ana' },
          rule,
          balance: 120,
          entries: [
            {
              id: 'entry-1',
              type: 'EARN' as const,
              points: 120,
              monetaryValue: '120.00',
              sale: { id: 'sale-1', receiptNumber: 'V-1' },
              saleReturnId: null,
              expiresAt: null,
              createdAt: '2026-08-29T00:00:00.000Z',
            },
          ],
        },
        meta: { apiVersion: '1' as const },
      }),
    ),
  };
  const customers = {
    list: vi.fn(() =>
      of({
        data: [
          {
            id: 'customer-1',
            name: 'Ana',
            identifier: null,
            email: null,
            phone: null,
            dataProcessingConsent: false,
            privacyStatus: 'ACTIVE' as const,
            anonymizedAt: null,
            privacyRetentionUntil: null,
            active: true,
            version: 1,
            createdAt: '2026-08-29T00:00:00.000Z',
            updatedAt: '2026-08-29T00:00:00.000Z',
            loyalty: { balance: 120 },
          },
        ],
        meta: { apiVersion: '1' as const, pagination: { total: 1, totalPages: 1 } },
      }),
    ),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoyaltyPanelComponent],
      providers: [
        { provide: LoyaltyApiService, useValue: loyalty },
        { provide: CustomerApiService, useValue: customers },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LoyaltyPanelComponent);
    fixture.detectChanges();
  });

  it('publishes a new immutable rule version and shows a customer ledger', () => {
    const component = fixture.componentInstance as never as {
      form: {
        controls: { customerId: { setValue(value: string): void } };
      };
      save(): void;
      loadStatement(): void;
      statement(): { balance: number } | null;
    };

    component.save();
    expect(loyalty.saveRule).toHaveBeenCalledWith({
      active: true,
      earnAmount: '1.00',
      earnPoints: 1,
      redeemPoints: 100,
      redeemAmount: '1.00',
      expirationDays: 365,
    });
    component.form.controls.customerId.setValue('customer-1');
    component.loadStatement();
    expect(loyalty.statement).toHaveBeenCalledWith('customer-1');
    expect(component.statement()?.balance).toBe(120);
  });
});
