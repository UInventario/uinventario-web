import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CustomerApiService, CustomerData } from './customer-api.service';
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
