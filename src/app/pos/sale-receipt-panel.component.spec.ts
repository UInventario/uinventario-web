import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PosApiService, SaleReceiptData } from './pos-api.service';
import { SaleReceiptPanelComponent } from './sale-receipt-panel.component';

describe('SaleReceiptPanelComponent', () => {
  let fixture: ComponentFixture<SaleReceiptPanelComponent>;
  let pos: {
    reprintSaleReceipt: ReturnType<typeof vi.fn>;
    sendSaleReceipt: ReturnType<typeof vi.fn>;
  };

  const receipt: SaleReceiptData = {
    saleId: 'sale-1',
    receiptNumber: 'V-ABC123',
    documentType: 'NON_FISCAL_SALE_RECEIPT',
    fiscalNotice: 'COMPROBANTE NO FISCAL',
    merchant: { name: 'Café Central', legalName: 'Café Central SA', countryCode: 'MX' },
    branchName: 'Sucursal Centro',
    cashRegister: { name: 'Caja 1', code: 'MAIN' },
    sellerEmail: 'cajera@example.com',
    customer: { name: 'Ana Pérez', identifier: 'CLI-1' },
    currency: 'MXN',
    taxRate: '0.1600',
    lines: [
      {
        lineNumber: 1,
        productName: 'Café molido',
        productSku: 'CAFE-1',
        quantity: '1.000',
        unitPrice: '119.90',
        subtotal: '103.36',
        tax: '16.54',
        total: '119.90',
      },
    ],
    payments: [
      {
        method: 'CASH',
        amountReceived: '120.00',
        amountApplied: '119.90',
        change: '0.10',
        reference: null,
        provider: 'CASH',
        authorizationCode: null,
      },
    ],
    totals: { subtotal: '103.36', tax: '16.54', total: '119.90' },
    issuedAt: '2026-08-28T12:00:00.000Z',
    saleStatus: 'COMPLETED',
    void: null,
  };

  beforeEach(async () => {
    pos = {
      reprintSaleReceipt: vi
        .fn()
        .mockReturnValue(of({ data: receipt, meta: { apiVersion: '1' as const } })),
      sendSaleReceipt: vi.fn().mockReturnValue(
        of({
          data: {
            receipt,
            delivery: {
              mode: 'SIMULATED' as const,
              channel: 'EMAIL' as const,
              recipient: 'ana@example.com',
              messageId: 'sim-1',
              acceptedAt: '2026-08-28T12:01:00.000Z',
            },
          },
          meta: { apiVersion: '1' as const },
        }),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [SaleReceiptPanelComponent],
      providers: [{ provide: PosApiService, useValue: pos }],
    }).compileComponents();
    fixture = TestBed.createComponent(SaleReceiptPanelComponent);
    fixture.componentRef.setInput('saleId', 'sale-1');
    fixture.detectChanges();
  });

  it('renders an accessible thermal receipt and reports simulated delivery', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    (fixture.nativeElement.querySelector('.receipt-launch button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(pos.reprintSaleReceipt).toHaveBeenCalledWith('sale-1');
    expect(fixture.nativeElement.textContent).toContain('COMPROBANTE NO FISCAL');
    expect(fixture.nativeElement.textContent).toContain('Café molido');
    expect(fixture.nativeElement.querySelector('table caption').textContent).toContain(
      'Productos vendidos',
    );

    const email = fixture.nativeElement.querySelector('input[type=email]') as HTMLInputElement;
    email.value = 'ana@example.com';
    email.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('.receipt-actions form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    fixture.detectChanges();
    expect(pos.sendSaleReceipt).toHaveBeenCalledWith('sale-1', 'ana@example.com');
    expect(fixture.nativeElement.textContent).toContain('No se envió correo real');

    (fixture.nativeElement.querySelector('.receipt-actions > button') as HTMLButtonElement).click();
    expect(print).toHaveBeenCalledOnce();
    expect(document.body.classList.contains('printing-sale-receipt')).toBe(true);
    globalThis.dispatchEvent(new Event('afterprint'));
    expect(document.body.classList.contains('printing-sale-receipt')).toBe(false);
    print.mockRestore();
  });
});
