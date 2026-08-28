import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PosApiService, SaleDetailData, SaleReturnData } from './pos-api.service';
import { SaleReturnPanelComponent } from './sale-return-panel.component';

describe('SaleReturnPanelComponent', () => {
  let fixture: ComponentFixture<SaleReturnPanelComponent>;
  let pos: {
    listSaleReturns: ReturnType<typeof vi.fn>;
    createSaleReturn: ReturnType<typeof vi.fn>;
  };

  const sale: SaleDetailData = {
    id: 'sale-1',
    receiptNumber: 'V-001',
    status: 'COMPLETED',
    context: {
      branch: { id: 'branch-1', name: 'Centro' },
      warehouse: { id: 'warehouse-1', name: 'General' },
      cashRegister: { id: 'register-1', name: 'Caja 1', code: 'MAIN' },
    },
    user: { id: 'user-1', email: 'admin@example.com' },
    customer: null,
    currency: 'MXN',
    taxRate: '0.1600',
    lines: [
      {
        id: 'line-1',
        product: { id: 'product-1', name: 'Café molido', sku: 'CAFE-1' },
        quantity: '2.000',
        unitPrice: '116.00',
        subtotal: '200.00',
        tax: '32.00',
        total: '232.00',
      },
    ],
    totals: { subtotal: '200.00', tax: '32.00', total: '232.00' },
    payment: {
      method: 'CASH',
      status: 'COMPLETED',
      amountReceived: '250.00',
      amountApplied: '232.00',
      change: '18.00',
      reference: null,
      provider: 'CASH',
      authorizationCode: null,
    },
    payments: [],
    createdAt: '2026-08-28T12:00:00.000Z',
    void: null,
    movements: [],
  };

  const saleReturn: SaleReturnData = {
    id: 'return-1',
    saleId: sale.id,
    exchangeSale: { id: 'sale-2', receiptNumber: 'V-002' },
    reason: 'Cambio de presentación',
    settlementStatus: 'PENDING',
    totals: { subtotal: '100.00', tax: '16.00', total: '116.00' },
    returnedBy: { id: 'user-1', email: 'admin@example.com' },
    createdAt: '2026-08-28T13:00:00.000Z',
    lines: [
      {
        id: 'return-line-1',
        saleLineId: 'line-1',
        product: { id: 'product-1', name: 'Café molido', sku: 'CAFE-1' },
        quantity: '1.000',
        condition: 'DAMAGED',
        totals: { subtotal: '100.00', tax: '16.00', total: '116.00' },
        serialNumbers: [],
      },
    ],
  };

  beforeEach(async () => {
    pos = {
      listSaleReturns: vi
        .fn()
        .mockReturnValue(of({ data: [], meta: { apiVersion: '1' as const } })),
      createSaleReturn: vi.fn().mockReturnValue(
        of({
          data: saleReturn,
          meta: { apiVersion: '1' as const, idempotentReplay: false },
        }),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [SaleReturnPanelComponent],
      providers: [{ provide: PosApiService, useValue: pos }],
    }).compileComponents();
    fixture = TestBed.createComponent(SaleReturnPanelComponent);
    fixture.componentRef.setInput('sale', sale);
    fixture.componentRef.setInput('exchangeOptions', [
      {
        id: 'sale-2',
        receiptNumber: 'V-002',
        status: 'COMPLETED',
        user: sale.user,
        customer: null,
        cashRegister: sale.context.cashRegister,
        currency: 'MXN',
        total: '120.00',
        paymentMethod: 'CASH',
        createdAt: sale.createdAt,
      },
    ]);
    fixture.detectChanges();
  });

  it('registers a damaged partial return, links the exchange and updates the remainder', () => {
    const quantity = fixture.nativeElement.querySelector(
      'input[formcontrolname=quantity]',
    ) as HTMLInputElement;
    quantity.value = '1';
    quantity.dispatchEvent(new Event('input'));
    const condition = fixture.nativeElement.querySelector(
      'select[formcontrolname=condition]',
    ) as HTMLSelectElement;
    condition.value = 'DAMAGED';
    condition.dispatchEvent(new Event('change'));
    const reason = fixture.nativeElement.querySelector(
      'textarea[formcontrolname=reason]',
    ) as HTMLTextAreaElement;
    reason.value = saleReturn.reason;
    reason.dispatchEvent(new Event('input'));
    const exchange = fixture.nativeElement.querySelector(
      'select[formcontrolname=exchangeSaleId]',
    ) as HTMLSelectElement;
    exchange.value = 'sale-2';
    exchange.dispatchEvent(new Event('change'));

    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    fixture.detectChanges();

    expect(pos.createSaleReturn).toHaveBeenCalledWith(
      'sale-1',
      {
        reason: saleReturn.reason,
        exchangeSaleId: 'sale-2',
        lines: [
          {
            saleLineId: 'line-1',
            quantity: '1',
            condition: 'DAMAGED',
            serialNumbers: [],
          },
        ],
      },
      expect.stringMatching(/^web-sale-return-/),
    );
    expect(fixture.nativeElement.textContent).toContain('pendiente 1.000');
    expect(fixture.nativeElement.textContent).toContain('Cambio V-002');
    expect(fixture.nativeElement.textContent).toContain('No entrega efectivo ni revierte pagos');
  });
});
