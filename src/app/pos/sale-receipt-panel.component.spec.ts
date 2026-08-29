import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { PosApiService, PosPeripheralProfileData, SaleReceiptData } from './pos-api.service';
import { SaleReceiptPanelComponent } from './sale-receipt-panel.component';
import { DesktopPeripheralService } from './desktop-peripheral.service';

describe('SaleReceiptPanelComponent', () => {
  let fixture: ComponentFixture<SaleReceiptPanelComponent>;
  let pos: {
    reprintSaleReceipt: ReturnType<typeof vi.fn>;
    sendSaleReceipt: ReturnType<typeof vi.fn>;
    getPeripheralProfile: ReturnType<typeof vi.fn>;
    updatePeripheralProfile: ReturnType<typeof vi.fn>;
    printSaleReceipt: ReturnType<typeof vi.fn>;
    openCashDrawer: ReturnType<typeof vi.fn>;
  };
  const desktop = {
    available: signal(false),
    printReceipt: vi.fn(),
    openDrawer: vi.fn(),
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
        grossTotal: '129.90',
        discountTotal: '10.00',
        lineDiscountReason: 'Empaque deteriorado',
        saleDiscountReason: null,
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
    totals: {
      gross: '129.90',
      discount: '10.00',
      subtotal: '103.36',
      tax: '16.54',
      total: '119.90',
    },
    issuedAt: '2026-08-28T12:00:00.000Z',
    saleStatus: 'COMPLETED',
    void: null,
  };
  const profile: PosPeripheralProfileData = {
    id: 'profile-1',
    cashRegister: { id: 'register-1', name: 'Caja 1', code: 'MAIN' },
    deviceId: 'SIM-register-1',
    label: 'Simulador Caja 1',
    adapter: 'SIMULATOR',
    printerEnabled: true,
    drawerEnabled: true,
    autoOpenCashSale: true,
    updatedAt: '2026-08-28T12:00:00.000Z',
  };

  beforeEach(async () => {
    desktop.available.set(false);
    desktop.printReceipt.mockReset().mockResolvedValue({
      status: 'COMPLETED',
      adapter: 'SYSTEM',
      replayed: false,
    });
    desktop.openDrawer.mockReset().mockResolvedValue({
      status: 'COMPLETED',
      adapter: 'SIMULATOR',
      replayed: false,
    });
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
      getPeripheralProfile: vi
        .fn()
        .mockReturnValue(of({ data: profile, meta: { apiVersion: '1' as const } })),
      updatePeripheralProfile: vi
        .fn()
        .mockReturnValue(of({ data: profile, meta: { apiVersion: '1' as const } })),
      printSaleReceipt: vi.fn().mockReturnValue(
        of({
          data: {
            receipt,
            operation: {
              id: 'operation-1',
              action: 'PRINT_RECEIPT' as const,
              trigger: 'MANUAL' as const,
              status: 'COMPLETED' as const,
              attemptCount: 1,
              errorCode: null,
              saleId: 'sale-1',
              deviceId: profile.deviceId,
              createdAt: '2026-08-28T12:02:00.000Z',
              completedAt: '2026-08-28T12:02:00.000Z',
            },
          },
          meta: { apiVersion: '1' as const, idempotentReplay: false },
        }),
      ),
      openCashDrawer: vi.fn().mockReturnValue(
        of({
          data: {
            id: 'operation-2',
            action: 'OPEN_DRAWER' as const,
            trigger: 'MANUAL' as const,
            status: 'COMPLETED' as const,
            attemptCount: 1,
            errorCode: null,
            saleId: null,
            deviceId: profile.deviceId,
            createdAt: '2026-08-28T12:03:00.000Z',
            completedAt: '2026-08-28T12:03:00.000Z',
          },
          meta: { apiVersion: '1' as const, idempotentReplay: false },
        }),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [SaleReceiptPanelComponent],
      providers: [
        { provide: PosApiService, useValue: pos },
        { provide: DesktopPeripheralService, useValue: desktop },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SaleReceiptPanelComponent);
    fixture.componentRef.setInput('saleId', 'sale-1');
    fixture.componentRef.setInput('canConfigure', true);
    fixture.componentRef.setInput('canOpenDrawer', true);
    fixture.detectChanges();
  });

  it('renders an accessible thermal receipt and reports simulated delivery', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    (fixture.nativeElement.querySelector('.receipt-launch button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(pos.reprintSaleReceipt).toHaveBeenCalledWith('sale-1');
    expect(fixture.nativeElement.textContent).toContain('COMPROBANTE NO FISCAL');
    expect(fixture.nativeElement.textContent).toContain('Café molido');
    expect(fixture.nativeElement.textContent).toContain('Descuento MXN 10.00');
    expect(fixture.nativeElement.textContent).toContain('Empaque deteriorado');
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
    expect(pos.printSaleReceipt).toHaveBeenCalledWith(
      'sale-1',
      expect.stringMatching(/^web-receipt-print-/),
    );
    expect(print).toHaveBeenCalledOnce();
    expect(document.body.classList.contains('printing-sale-receipt')).toBe(true);
    globalThis.dispatchEvent(new Event('afterprint'));
    expect(document.body.classList.contains('printing-sale-receipt')).toBe(false);
    print.mockRestore();
  });

  it('configures the simulated device and opens the drawer independently from the sale', () => {
    (fixture.nativeElement.querySelector('.receipt-launch button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('.peripheral-profile form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(pos.updatePeripheralProfile).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: profile.deviceId, adapter: 'SIMULATOR' }),
    );

    const drawer = Array.from(
      fixture.nativeElement.querySelectorAll('.receipt-actions > button'),
    ).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('Abrir'),
    ) as HTMLButtonElement;
    drawer.click();
    fixture.detectChanges();
    expect(pos.openCashDrawer).toHaveBeenCalledWith(
      { trigger: 'MANUAL' },
      expect.stringMatching(/^web-drawer-manual-/),
    );
    expect(fixture.nativeElement.textContent).toContain('Pulso de cajon enviado');
  });

  it('sends only confirmed peripheral operations to Desktop without repeating the sale', async () => {
    desktop.available.set(true);
    fixture.componentRef.setInput('tenantId', 'tenant-1');
    (fixture.nativeElement.querySelector('.receipt-launch button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    (fixture.nativeElement.querySelector('.receipt-actions > button') as HTMLButtonElement).click();
    await Promise.resolve();

    expect(pos.printSaleReceipt).toHaveBeenCalledOnce();
    expect(desktop.printReceipt).toHaveBeenCalledWith(
      { tenantId: 'tenant-1', cashRegisterId: 'register-1', deviceId: profile.deviceId },
      'operation-1',
      expect.objectContaining({ receiptNumber: receipt.receiptNumber, total: '119.90' }),
    );
    expect(print).not.toHaveBeenCalled();

    const drawer = Array.from(
      fixture.nativeElement.querySelectorAll('.receipt-actions > button'),
    ).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('Abrir'),
    ) as HTMLButtonElement;
    drawer.click();
    await Promise.resolve();

    expect(pos.openCashDrawer).toHaveBeenCalledOnce();
    expect(desktop.openDrawer).toHaveBeenCalledWith(
      { tenantId: 'tenant-1', cashRegisterId: 'register-1', deviceId: profile.deviceId },
      'operation-2',
      'MANUAL',
    );
    print.mockRestore();
  });
});
