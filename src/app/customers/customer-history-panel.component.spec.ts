import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  CustomerApiService,
  CustomerCreditPaymentData,
  CustomerCreditStatementData,
  CustomerData,
  CustomerHistoryData,
} from './customer-api.service';
import { CustomerHistoryPanelComponent } from './customer-history-panel.component';

describe('CustomerHistoryPanelComponent', () => {
  let fixture: ComponentFixture<CustomerHistoryPanelComponent>;
  const customer: CustomerData = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Ana Pérez',
    identifier: 'CLI-001',
    email: 'ana@example.com',
    phone: null,
    dataProcessingConsent: true,
    privacyStatus: 'ACTIVE',
    anonymizedAt: null,
    privacyRetentionUntil: null,
    active: true,
    version: 1,
    createdAt: '2026-08-27T10:00:00.000Z',
    updatedAt: '2026-08-27T10:00:00.000Z',
  };
  const api = { history: vi.fn() };

  beforeEach(async () => {
    api.history.mockReturnValue(
      of({
        data: {
          customer,
          credit: null,
          summary: {
            currency: 'MXN',
            salesCount: 2,
            completedCount: 1,
            voidedCount: 1,
            completedAmount: '100.00',
            voidedAmount: '80.00',
          },
          items: [
            {
              id: 'sale-voided',
              receiptNumber: 'V-0002',
              status: 'VOIDED',
              currency: 'MXN',
              total: '80.00',
              createdAt: '2026-08-27T12:00:00.000Z',
              cashRegister: { id: 'register', name: 'Caja', code: 'MAIN' },
              responsible: { id: 'user', email: 'cashier@example.com' },
              payments: [
                {
                  method: 'CASH',
                  status: 'REVERSED',
                  amountApplied: '80.00',
                  amountReceived: '100.00',
                  change: '20.00',
                },
              ],
              reversal: {
                reason: 'Cambio solicitado',
                voidedAt: '2026-08-27T12:05:00.000Z',
              },
            },
          ],
        },
        meta: {
          apiVersion: '1',
          scope: { branchId: 'branch' },
          pagination: { page: 1, pageSize: 5, total: 2, totalPages: 1 },
        },
      }),
    );
    await TestBed.configureTestingModule({
      imports: [CustomerHistoryPanelComponent],
      providers: [{ provide: CustomerApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(CustomerHistoryPanelComponent);
    fixture.componentRef.setInput('customer', customer);
    fixture.detectChanges();
  });

  it('shows scoped sales, reversed payments and opens the sale detail', () => {
    expect(api.history).toHaveBeenCalledWith(customer.id, {
      status: 'ALL',
      page: 1,
      pageSize: 5,
    });
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('2');
    expect(text).toContain('V-0002');
    expect(text).toContain('Reversado');
    expect(text).toContain('Cambio solicitado');

    const selected = vi.fn();
    fixture.componentInstance.saleSelected.subscribe(selected);
    const button = [...fixture.nativeElement.querySelectorAll('button')].find(
      (candidate: HTMLButtonElement) => candidate.textContent?.includes('Ver venta'),
    ) as HTMLButtonElement;
    button.click();
    expect(selected).toHaveBeenCalledWith('sale-voided');
  });

  it('sends status and date filters without changing customer identity', () => {
    const component = fixture.componentInstance as unknown as {
      filters: {
        setValue(value: { status: 'VOIDED'; dateFrom: string; dateTo: string }): void;
      };
      applyFilters(): void;
    };
    component.filters.setValue({
      status: 'VOIDED',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });
    component.applyFilters();
    expect(api.history).toHaveBeenLastCalledWith(customer.id, {
      status: 'VOIDED',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      page: 1,
      pageSize: 5,
    });
  });
});

describe('CustomerHistoryPanelComponent credit payments', () => {
  let fixture: ComponentFixture<CustomerHistoryPanelComponent>;
  let api: {
    history: ReturnType<typeof vi.fn>;
    createCreditPayment: ReturnType<typeof vi.fn>;
    reverseCreditPayment: ReturnType<typeof vi.fn>;
  };

  const customer: CustomerData = {
    id: 'customer-1',
    name: 'Cliente crédito',
    identifier: 'CREDIT-1',
    email: null,
    phone: null,
    dataProcessingConsent: false,
    privacyStatus: 'ACTIVE',
    anonymizedAt: null,
    privacyRetentionUntil: null,
    active: true,
    version: 2,
    createdAt: '2026-08-29T10:00:00.000Z',
    updatedAt: '2026-08-29T10:00:00.000Z',
    credit: {
      enabled: true,
      limit: '150.00',
      currency: 'MXN',
      termDays: 30,
      maxInstallments: 3,
      balance: '100.00',
      available: '50.00',
      overdueAmount: '40.00',
      status: 'OVERDUE',
    },
  };

  const payment: CustomerCreditPaymentData = {
    id: 'payment-1',
    receiptNumber: 'CP-0001',
    currency: 'MXN',
    amount: '20.00',
    method: 'CASH',
    status: 'COMPLETED',
    reference: null,
    provider: 'CASH',
    providerReference: null,
    responsible: { id: 'user-1', email: 'admin@example.com' },
    context: {
      branch: { id: 'branch-1', name: 'Centro' },
      cashRegister: { id: 'register-1', name: 'Caja 1', code: 'MAIN' },
    },
    allocations: [
      {
        accountId: 'account-1',
        installmentId: 'installment-1',
        installmentNumber: 1,
        amount: '20.00',
      },
    ],
    reversal: null,
    createdAt: '2026-08-29T11:00:00.000Z',
  };

  const statement = (input: {
    balance: string;
    overdueAmount: string;
    payment?: CustomerCreditPaymentData;
  }): CustomerCreditStatementData => ({
    currency: 'MXN',
    balance: input.balance,
    overdueAmount: input.overdueAmount,
    status: Number(input.overdueAmount) > 0 ? 'OVERDUE' : 'AVAILABLE',
    accounts: [
      {
        id: 'account-1',
        sale: { id: 'sale-1', receiptNumber: 'V-0001' },
        originalAmount: '100.00',
        balance: input.balance,
        dueDate: '2026-09-28',
        status: input.balance === '100.00' ? 'OVERDUE' : 'PARTIAL',
        installments: [
          {
            id: 'installment-1',
            number: 1,
            dueDate: '2026-08-28',
            amount: '40.00',
            paidAmount: input.balance === '80.00' ? '20.00' : '0.00',
            balance: input.balance === '80.00' ? '20.00' : '40.00',
            status: 'OVERDUE',
          },
        ],
      },
    ],
    payments: input.payment ? [input.payment] : [],
  });

  beforeEach(async () => {
    const initialHistory: CustomerHistoryData = {
      customer,
      credit: statement({ balance: '100.00', overdueAmount: '40.00' }),
      summary: {
        currency: 'MXN',
        salesCount: 1,
        completedCount: 1,
        voidedCount: 0,
        completedAmount: '100.00',
        voidedAmount: '0.00',
      },
      items: [],
    };
    const paidStatement = statement({
      balance: '80.00',
      overdueAmount: '20.00',
      payment,
    });
    const reversedPayment: CustomerCreditPaymentData = {
      ...payment,
      status: 'REVERSED',
      reversal: {
        reason: 'Cobro capturado por error',
        user: payment.responsible,
        providerReference: null,
        reversedAt: '2026-08-29T11:05:00.000Z',
      },
    };
    api = {
      history: vi.fn().mockReturnValue(
        of({
          data: initialHistory,
          meta: {
            apiVersion: '1' as const,
            scope: { branchId: 'branch-1' },
            pagination: { page: 1, pageSize: 5, total: 0, totalPages: 0 },
          },
        }),
      ),
      createCreditPayment: vi.fn().mockReturnValue(
        of({
          data: { payment, credit: paidStatement },
          meta: { apiVersion: '1' as const, idempotentReplay: false },
        }),
      ),
      reverseCreditPayment: vi.fn().mockReturnValue(
        of({
          data: {
            payment: reversedPayment,
            credit: statement({
              balance: '100.00',
              overdueAmount: '40.00',
              payment: reversedPayment,
            }),
          },
          meta: { apiVersion: '1' as const, idempotentReplay: false },
        }),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [CustomerHistoryPanelComponent],
      providers: [{ provide: CustomerApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(CustomerHistoryPanelComponent);
    fixture.componentRef.setInput('customer', customer);
    fixture.componentRef.setInput('canManageCredit', true);
    fixture.componentRef.setInput('paymentMethods', ['CASH', 'TRANSFER']);
    fixture.detectChanges();
  });

  it('applies a cash payment and reverses its receipt from the customer statement', () => {
    const amount = fixture.nativeElement.querySelector('#creditPaymentAmount') as HTMLInputElement;
    amount.value = '20.00';
    amount.dispatchEvent(new Event('input'));
    (
      fixture.nativeElement.querySelector('form.credit-payment-form') as HTMLFormElement
    ).dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(api.createCreditPayment).toHaveBeenCalledWith(
      customer.id,
      { amount: '20.00', method: 'CASH' },
      expect.stringMatching(/^web-credit-payment-/),
    );
    expect(fixture.nativeElement.textContent).toContain('Abono CP-0001 aplicado');
    expect(fixture.nativeElement.textContent).toContain('MXN 80.00');

    const reverseButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === 'Reversar');
    reverseButton?.click();
    fixture.detectChanges();
    const reason = fixture.nativeElement.querySelector(
      'form.reversal-form input[formcontrolname=reason]',
    ) as HTMLInputElement;
    reason.value = 'Cobro capturado por error';
    reason.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('form.reversal-form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    fixture.detectChanges();

    expect(api.reverseCreditPayment).toHaveBeenCalledWith(
      customer.id,
      payment.id,
      'Cobro capturado por error',
      expect.stringMatching(/^web-credit-payment-reversal-/),
    );
    expect(fixture.nativeElement.textContent).toContain('Abono CP-0001 reversado');
    expect(fixture.nativeElement.textContent).toContain('MXN 100.00');
  });
});
