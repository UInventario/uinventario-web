import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DesktopPeripheralPort } from '../../../../../core/desktop/desktop-peripheral.port';
import { PosPeripheralApi } from '../../../../../core/desktop/pos-peripheral-api';
import { SessionState } from '../../../../../core/session/session-state';
import { SalesLifecycleFacade } from '../../application/sales-lifecycle.facade';
import { SaleReceipt } from '../../domain/sales-lifecycle.models';
import { ReceiptDialog } from './receipt-dialog';

const receipt: SaleReceipt = {
  saleId: 'sale-1',
  receiptNumber: 'V-000001',
  documentType: 'NON_FISCAL_SALE_RECEIPT',
  fiscalNotice: 'COMPROBANTE NO FISCAL',
  merchant: { name: 'Tienda Central', legalName: null, countryCode: 'MX' },
  branchName: 'Centro',
  cashRegister: { name: 'Caja 1', code: 'CAJA-01' },
  sellerEmail: 'cashier@example.com',
  customer: null,
  currency: 'MXN',
  taxRate: '0.0000',
  lines: [
    {
      lineNumber: 1,
      productName: 'Café molido',
      productSku: 'CAF-001',
      quantity: '1.000',
      unitPrice: '120.00',
      discountTotal: '0.00',
      total: '120.00',
    },
  ],
  payments: [
    {
      method: 'CASH',
      amountReceived: '120.00',
      amountApplied: '120.00',
      change: '0.00',
      reference: null,
      provider: 'INTERNAL',
      authorizationCode: null,
    },
  ],
  totals: {
    gross: '120.00',
    discount: '0.00',
    subtotal: '120.00',
    tax: '0.00',
    total: '120.00',
  },
  issuedAt: '2026-08-31T00:00:00.000Z',
  saleStatus: 'COMPLETED',
  void: null,
};

describe('ReceiptDialog Desktop printing', () => {
  const available = signal(true);
  const desktop = {
    available: available.asReadonly(),
    printReceipt: vi.fn().mockResolvedValue({ status: 'COMPLETED', adapter: 'SYSTEM' }),
  };
  const peripherals = { printReceipt: vi.fn() };
  let fixture: ComponentFixture<ReceiptDialog>;

  beforeEach(() => {
    available.set(true);
    desktop.printReceipt.mockClear();
    peripherals.printReceipt.mockReset().mockReturnValue(
      of({
        receipt,
        operation: { id: 'operation-1', deviceId: 'device-1', status: 'COMPLETED' },
      }),
    );
    TestBed.configureTestingModule({
      imports: [ReceiptDialog],
      providers: [
        { provide: SalesLifecycleFacade, useValue: { sendReceipt: vi.fn() } },
        { provide: DesktopPeripheralPort, useValue: desktop },
        { provide: PosPeripheralApi, useValue: peripherals },
        {
          provide: SessionState,
          useValue: {
            session: signal({
              tenant: { id: 'tenant-1', name: 'Tienda Central' },
              context: {
                cashRegister: { id: 'register-1', name: 'Caja 1', code: 'CAJA-01' },
              },
            }),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(ReceiptDialog);
    fixture.componentRef.setInput('receipt', receipt);
    fixture.detectChanges();
  });

  it('confirms the server operation before invoking the native printer', async () => {
    (fixture.nativeElement.querySelector('.receipt-actions > button') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(peripherals.printReceipt).toHaveBeenCalledWith('sale-1', expect.any(String));
    expect(desktop.printReceipt).toHaveBeenCalledWith(
      { tenantId: 'tenant-1', cashRegisterId: 'register-1', deviceId: 'device-1' },
      'operation-1',
      expect.objectContaining({ receiptNumber: 'V-000001', total: '120.00' }),
    );
  });

  it('uses browser printing when no Desktop bridge exists', () => {
    available.set(false);
    fixture.detectChanges();
    const popup = {
      document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn(),
    };
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);

    (fixture.nativeElement.querySelector('.receipt-actions > button') as HTMLButtonElement).click();

    expect(popup.document.write).toHaveBeenCalledOnce();
    expect(popup.print).toHaveBeenCalledOnce();
    expect(peripherals.printReceipt).not.toHaveBeenCalled();
  });

  it('reuses the confirmed operation when the native response fails', async () => {
    desktop.printReceipt
      .mockRejectedValueOnce(new Error('DEVICE_RESPONSE_LOST'))
      .mockResolvedValueOnce({ status: 'COMPLETED', adapter: 'SYSTEM', replayed: true });
    const button = fixture.nativeElement.querySelector(
      '.receipt-actions > button',
    ) as HTMLButtonElement;

    button.click();
    await fixture.whenStable();
    button.click();
    await fixture.whenStable();

    expect(peripherals.printReceipt).toHaveBeenCalledTimes(2);
    expect(peripherals.printReceipt.mock.calls[1]?.[1]).toBe(
      peripherals.printReceipt.mock.calls[0]?.[1],
    );
    expect(desktop.printReceipt).toHaveBeenCalledTimes(2);
    expect(desktop.printReceipt.mock.calls[1]?.[1]).toBe('operation-1');
  });
});
