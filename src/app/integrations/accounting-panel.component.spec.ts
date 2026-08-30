import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AccountingApiService, AccountingEventData } from './accounting-api.service';
import { AccountingPanelComponent } from './accounting-panel.component';

describe('AccountingPanelComponent', () => {
  let fixture: ComponentFixture<AccountingPanelComponent>;
  const event: AccountingEventData = {
    id: '11111111-1111-4111-8111-111111111111',
    eventKey: 'SALE:sale-1',
    sourceType: 'SALE',
    sourceId: 'sale-1',
    provider: 'SIMULATOR',
    contractVersion: '1',
    currency: 'MXN',
    occurredAt: '2026-08-29T12:00:00.000Z',
    reference: 'S-1',
    journalStatus: 'CANDIDATE_NOT_POSTED',
    entries: [
      { accountReference: '1100-CLEARING', debit: '116.00', credit: '0.00', memo: 'Cobro' },
      { accountReference: '4100-SALES', debit: '0.00', credit: '116.00', memo: 'Venta' },
    ],
    debitTotal: '116.00',
    creditTotal: '116.00',
    status: 'PENDING',
    attemptCount: 0,
    errorCode: null,
    providerReference: null,
    createdAt: '2026-08-29T12:00:00.000Z',
    updatedAt: '2026-08-29T12:00:00.000Z',
  };
  const config = {
    provider: 'SIMULATOR' as const,
    contractVersion: '1' as const,
    paymentClearingAccount: '1100-CLEARING',
    salesRevenueAccount: '4100-SALES',
    salesReturnsAccount: '4110-RETURNS',
    taxPayableAccount: '2100-TAX',
    inventoryAssetAccount: '1200-INVENTORY',
    costOfGoodsSoldAccount: '5100-COGS',
    cashAccount: '1000-CASH',
    cashClearingAccount: '2190-CASH-CLEARING',
    updatedAt: event.updatedAt,
  };
  const api = {
    contract: vi.fn().mockReturnValue(
      of({
        data: {
          sources: ['SALE', 'SALE_VOID', 'SALE_RETURN', 'CASH_MOVEMENT'],
          journalStatus: 'CANDIDATE_NOT_POSTED',
        },
        meta: {},
      }),
    ),
    configData: vi.fn().mockReturnValue(of({ data: config, meta: {} })),
    events: vi.fn().mockReturnValue(of({ data: [event], meta: {} })),
    saveConfig: vi.fn().mockReturnValue(of({ data: config, meta: {} })),
    generate: vi.fn().mockReturnValue(of({ data: [], meta: { discovered: 0, created: 0 } })),
    deliver: vi.fn().mockReturnValue(
      of({
        data: {
          ...event,
          status: 'INDETERMINATE' as const,
          errorCode: 'SIMULATED_ACCOUNTING_TIMEOUT',
        },
        meta: {},
      }),
    ),
    reconcile: vi
      .fn()
      .mockReturnValue(
        of({ data: { ...event, status: 'EXPORTED' as const, attemptCount: 2 }, meta: {} }),
      ),
  };

  beforeEach(async () => {
    Object.values(api).forEach((mock) => mock.mockClear());
    await TestBed.configureTestingModule({
      imports: [AccountingPanelComponent],
      providers: [{ provide: AccountingApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(AccountingPanelComponent);
    fixture.detectChanges();
  });

  it('labels balanced journals as candidates rather than posted entries', () => {
    const text = fixture.nativeElement.textContent as string;
    ['SALE', 'SALE_VOID', 'SALE_RETURN', 'CASH_MOVEMENT'].forEach((source) =>
      expect(text).toContain(source),
    );
    expect(text).toContain('CANDIDATO · NO CONTABILIZADO');
    expect(text).toContain('Débitos 116.00 = Créditos 116.00');
  });

  it('saves account references and discovers candidates idempotently', () => {
    const save = [...fixture.nativeElement.querySelectorAll('button')].find(
      (candidate: HTMLButtonElement) => candidate.textContent?.includes('Guardar cuentas'),
    ) as HTMLButtonElement;
    save.click();
    fixture.detectChanges();
    const generate = [...fixture.nativeElement.querySelectorAll('button')].find(
      (candidate: HTMLButtonElement) => candidate.textContent?.includes('Generar candidatos'),
    ) as HTMLButtonElement;
    generate.click();
    fixture.detectChanges();

    expect(api.saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ salesRevenueAccount: '4100-SALES' }),
    );
    expect(api.generate).toHaveBeenCalledOnce();
  });

  it('exposes reconciliation after an indeterminate delivery', () => {
    const scenario = fixture.nativeElement.querySelector('.toolbar select') as HTMLSelectElement;
    scenario.value = 'TIMEOUT';
    scenario.dispatchEvent(new Event('change'));
    const deliver = [...fixture.nativeElement.querySelectorAll('button')].find(
      (candidate: HTMLButtonElement) => candidate.textContent?.trim() === 'Entregar',
    ) as HTMLButtonElement;
    deliver.click();
    fixture.detectChanges();

    expect(api.deliver).toHaveBeenCalledWith(event.id, 'TIMEOUT');
    const reconcile = [...fixture.nativeElement.querySelectorAll('button')].find(
      (candidate: HTMLButtonElement) => candidate.textContent?.trim() === 'Conciliar',
    ) as HTMLButtonElement;
    expect(reconcile.disabled).toBe(false);
    reconcile.click();
    fixture.detectChanges();
    expect(api.reconcile).toHaveBeenCalledWith(event.id);
    expect(fixture.nativeElement.textContent).toContain('EXPORTED');
  });
});
