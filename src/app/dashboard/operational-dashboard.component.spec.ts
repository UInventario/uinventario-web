import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SessionApiService, SessionData } from '../auth/session-api.service';
import { InventoryApiService } from '../inventory/inventory-api.service';
import { OfflineStoreService } from '../offline/offline-store.service';
import { PosApiService } from '../pos/pos-api.service';
import { PurchaseOrderApiService } from '../procurement/purchase-order-api.service';
import { OperationalDashboardComponent } from './operational-dashboard.component';

describe('OperationalDashboardComponent', () => {
  let fixture: ComponentFixture<OperationalDashboardComponent>;
  let session: ReturnType<typeof signal<SessionData | null>>;
  let pos: {
    salesCashReport: ReturnType<typeof vi.fn>;
    profitabilityReport: ReturnType<typeof vi.fn>;
  };
  let inventory: { listStockAlerts: ReturnType<typeof vi.fn> };
  let purchases: { list: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    localStorage.clear();
    session = signal<SessionData | null>({
      user: {
        id: 'user',
        email: 'admin@example.com',
        roles: ['ADMIN'],
        permissions: [
          'SALES_MANAGE',
          'INVENTORY_VALUATION_MANAGE',
          'INVENTORY_VIEW',
          'PURCHASE_ORDERS_MANAGE',
        ],
      },
      tenant: { id: 'tenant', name: 'Tienda' },
      context: {
        branch: { id: 'branch', name: 'Centro' },
        warehouse: { id: 'warehouse', name: 'Principal' },
        cashRegister: { id: 'register', name: 'Caja', code: 'MAIN' },
      },
      nextStep: 'APPLICATION',
    });
    pos = {
      salesCashReport: vi.fn().mockReturnValue(
        of({
          data: {
            scope: [{ id: 'branch', name: 'Centro', timezone: 'America/Mexico_City' }],
            options: { branches: [], registers: [], users: [] },
            summary: {
              sales: { total: 2, completed: 2, voided: 0, net: '200.00', voidedAmount: '0.00' },
              payments: [],
              cash: {
                shifts: 1,
                open: 1,
                closed: 0,
                expected: '200.00',
                counted: '0.00',
                difference: '0.00',
              },
              reconciliation: { salesNet: '200.00', paymentsApplied: '200.00', matches: true },
            },
            sales: [],
            shifts: [],
            total: 2,
          },
          meta: {
            apiVersion: '1',
            pagination: { page: 1, pageSize: 1, total: 2, totalPages: 2 },
            periodTimezone: 'BRANCH_LOCAL',
          },
        }),
      ),
      profitabilityReport: vi.fn().mockReturnValue(
        of({
          data: {
            scope: [],
            formulas: {},
            currencies: [
              { currency: 'MXN', margin: '80.00', netRevenue: '150.00', netCost: '70.00' },
            ],
            products: [],
            activities: [],
            total: 2,
          },
          meta: {
            apiVersion: '1',
            pagination: { page: 1, pageSize: 1, total: 2, totalPages: 2 },
            periodTimezone: 'BRANCH_LOCAL',
          },
        }),
      ),
    };
    inventory = {
      listStockAlerts: vi.fn().mockImplementation(({ status }: { status: string }) =>
        of({
          data: [],
          meta: {
            apiVersion: '1',
            defaultThreshold: '5.000',
            scope: {
              branch: { id: 'branch', name: 'Centro' },
              warehouse: { id: 'warehouse', name: 'Principal' },
            },
            pagination: {
              page: 1,
              pageSize: 1,
              total: status === 'LOW' ? 2 : 1,
              totalPages: status === 'LOW' ? 2 : 1,
            },
          },
        }),
      ),
    };
    purchases = {
      list: vi.fn().mockReturnValue(
        of({
          data: [],
          meta: {
            apiVersion: '1',
            pagination: { page: 1, pageSize: 1, total: 3, totalPages: 3 },
          },
        }),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [OperationalDashboardComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: SessionApiService, useValue: { session } },
        { provide: PosApiService, useValue: pos },
        { provide: InventoryApiService, useValue: inventory },
        { provide: PurchaseOrderApiService, useValue: purchases },
        {
          provide: OfflineStoreService,
          useValue: {
            deviceId: vi.fn().mockResolvedValue('device'),
            summary: vi
              .fn()
              .mockResolvedValue({ entities: 12, generatedAt: '2026-08-29T12:00:00.000Z' }),
            outbox: vi.fn().mockResolvedValue([
              { status: 'PENDING', retryable: true },
              { status: 'ERROR', retryable: false },
            ]),
            freshness: vi.fn().mockResolvedValue({ condition: 'FRESH' }),
          },
        },
      ],
    }).compileComponents();
  });

  it('shows reconciled, fresh and actionable widgets for the authorized context', async () => {
    fixture = TestBed.createComponent(OperationalDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Centro · Principal');
    expect(text).toContain('200.00');
    expect(text).toContain('Zona horaria: America/Mexico_City');
    expect(text).toContain('80.00 MXN');
    expect(text).toContain('1 agotado(s) · 2 bajo umbral');
    expect(text).toMatch(/Compras[\s\S]*3Órdenes registradas/);
    expect(text).toContain('Vigente');
    expect(text).toContain('1 pendiente(s) · 1 conflicto(s)');
    expect(pos.salesCashReport).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'branch', status: 'ALL', page: 1, pageSize: 1 }),
    );
    expect(inventory.listStockAlerts).toHaveBeenCalledTimes(2);
  });

  it('does not render or request sensitive and unauthorized widgets', async () => {
    session.set({
      ...session()!,
      user: { ...session()!.user, permissions: ['SALES_MANAGE'] },
    });
    fixture = TestBed.createComponent(OperationalDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Ventas y caja');
    expect(text).not.toContain('Ingreso sin impuestos menos costo histórico');
    expect(text).not.toContain('Stock bajo');
    expect(text).not.toContain('Órdenes de compra registradas');
    expect(pos.profitabilityReport).not.toHaveBeenCalled();
    expect(inventory.listStockAlerts).not.toHaveBeenCalled();
    expect(purchases.list).not.toHaveBeenCalled();
  });

  it('persists personal widget visibility', async () => {
    fixture = TestBed.createComponent(OperationalDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const marginToggle = [...fixture.nativeElement.querySelectorAll('input[type="checkbox"]')].find(
      (input: HTMLInputElement) => input.parentElement?.textContent?.includes('Margen'),
    ) as HTMLInputElement;
    marginToggle.checked = false;
    marginToggle.dispatchEvent(new Event('change'));
    const dates = fixture.nativeElement.querySelectorAll(
      'input[type="date"]',
    ) as NodeListOf<HTMLInputElement>;
    dates[0].value = '2026-08-01';
    dates[0].dispatchEvent(new Event('input'));
    dates[1].value = '2026-08-29';
    dates[1].dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain(
      'Ingreso sin impuestos menos costo histórico',
    );
    expect(localStorage.getItem('uinventario:dashboard:tenant:user')).toContain('"margin":false');
    expect(localStorage.getItem('uinventario:dashboard:tenant:user')).toContain(
      '"period":{"dateFrom":"2026-08-01","dateTo":"2026-08-29"}',
    );

    fixture.destroy();
    fixture = TestBed.createComponent(OperationalDashboardComponent);
    fixture.detectChanges();
    const restoredDates = fixture.nativeElement.querySelectorAll(
      'input[type="date"]',
    ) as NodeListOf<HTMLInputElement>;
    expect(restoredDates[0].value).toBe('2026-08-01');
    expect(restoredDates[1].value).toBe('2026-08-29');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Ingreso sin impuestos menos costo histórico',
    );
  });

  it('announces an invalid period without requesting new metrics', async () => {
    fixture = TestBed.createComponent(OperationalDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    pos.salesCashReport.mockClear();
    pos.profitabilityReport.mockClear();
    inventory.listStockAlerts.mockClear();
    purchases.list.mockClear();

    const dates = fixture.nativeElement.querySelectorAll(
      'input[type="date"]',
    ) as NodeListOf<HTMLInputElement>;
    dates[0].value = '2026-08-30';
    dates[0].dispatchEvent(new Event('input'));
    dates[1].value = '2026-08-29';
    dates[1].dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'La fecha inicial no puede ser posterior',
    );
    expect(pos.salesCashReport).not.toHaveBeenCalled();
    expect(pos.profitabilityReport).not.toHaveBeenCalled();
    expect(inventory.listStockAlerts).not.toHaveBeenCalled();
    expect(purchases.list).not.toHaveBeenCalled();
  });
});
