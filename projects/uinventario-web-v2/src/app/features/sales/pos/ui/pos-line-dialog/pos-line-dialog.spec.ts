import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PosFacade } from '../../application/pos.facade';
import { PosCartLine, PosProduct } from '../../domain/pos.models';
import { PosLineDialog } from './pos-line-dialog';

describe('PosLineDialog traceability', () => {
  const product: PosProduct = {
    id: 'product-1',
    name: 'Equipo controlado',
    sku: 'EQ-01',
    barcode: null,
    withoutCode: true,
    stockBehavior: 'TRACKED',
    taxBehavior: 'STANDARD',
    baseUnit: 'UNIT',
    quantityPrecision: 0,
    quantityRounding: 'HALF_UP',
    minimumQuantity: '1.000',
    trackLots: true,
    trackSerials: true,
    allowExpiredStockOverride: false,
    price: '100.00',
    active: true,
    sellable: true,
  };
  const facade = {
    listLots: vi.fn(() =>
      of([
        {
          id: 'lot-1',
          code: 'LOT-01',
          quantity: '2.000',
          expiresOn: '2027-08-31',
          expirationStatus: 'ACTIVE' as const,
          daysUntilExpiration: 365,
          balances: [],
        },
        {
          id: 'lot-expired',
          code: 'LOT-VENCIDO',
          quantity: '1.000',
          expiresOn: '2026-01-01',
          expirationStatus: 'EXPIRED' as const,
          daysUntilExpiration: -200,
          balances: [],
        },
      ]),
    ),
    listSerials: vi.fn(() =>
      of([
        {
          id: 'serial-1',
          serialNumber: 'SER-001',
          status: 'AVAILABLE' as const,
          currentLocation: { id: 'location-1', name: 'Piso', code: 'P-01' },
        },
      ]),
    ),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: PosFacade, useValue: facade }] });
  });

  it('requires and emits one available serial plus the selected lot', () => {
    const fixture = TestBed.createComponent(PosLineDialog);
    const root = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('line', { product, quantity: '1.000' } satisfies PosCartLine);
    let submitted: PosCartLine | undefined;
    fixture.componentInstance.submitted.subscribe((line) => (submitted = line));
    fixture.detectChanges();

    root.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(submitted).toBeUndefined();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Selecciona el lote');

    const lot = root.querySelector<HTMLSelectElement>('[formControlName="lotId"]')!;
    lot.value = 'lot-1';
    lot.dispatchEvent(new Event('change'));
    const serial = root.querySelector<HTMLInputElement>('[type="checkbox"]')!;
    serial.checked = true;
    serial.dispatchEvent(new Event('change'));
    root.querySelector('form')!.dispatchEvent(new Event('submit'));

    expect(submitted).toMatchObject({
      quantity: '1.000',
      lotId: 'lot-1',
      serialNumbers: ['SER-001'],
    });
  });

  it('requires policy, permission and an auditable reason for an expired lot', () => {
    const fixture = TestBed.createComponent(PosLineDialog);
    const root = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('line', {
      product: { ...product, trackSerials: false, allowExpiredStockOverride: true },
      quantity: '1.000',
    } satisfies PosCartLine);
    fixture.componentRef.setInput('canOverrideExpired', true);
    let submitted: PosCartLine | undefined;
    fixture.componentInstance.submitted.subscribe((line) => (submitted = line));
    fixture.detectChanges();

    const lot = root.querySelector<HTMLSelectElement>('[formControlName="lotId"]')!;
    lot.value = 'lot-expired';
    lot.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    root.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(submitted).toBeUndefined();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Explica por qué');

    const reason = root.querySelector<HTMLInputElement>(
      '[formControlName="expiredLotOverrideReason"]',
    )!;
    reason.value = 'Autorización sanitaria documentada';
    reason.dispatchEvent(new Event('input'));
    root.querySelector('form')!.dispatchEvent(new Event('submit'));
    expect(submitted).toMatchObject({
      lotId: 'lot-expired',
      expiredLotOverrideReason: 'Autorización sanitaria documentada',
    });
  });
});
