import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SessionApiService, SessionData } from '../auth/session-api.service';
import {
  InventoryApiService,
  InventoryStockAlertData,
  InventoryStockItem,
} from './inventory-api.service';
import { StockAlertPanelComponent } from './stock-alert-panel.component';

describe('StockAlertPanelComponent', () => {
  let fixture: ComponentFixture<StockAlertPanelComponent>;
  let inventory: {
    listStockAlerts: ReturnType<typeof vi.fn>;
    setStockAlertThreshold: ReturnType<typeof vi.fn>;
  };

  const alert: InventoryStockAlertData = {
    product: { id: 'product-1', name: 'Café', sku: 'CAFE-1' },
    location: { id: 'location-1', name: 'General', code: 'GEN' },
    status: 'LOW',
    availableQuantity: '3.000',
    threshold: '5.000',
    transitionedAt: '2026-08-28T12:00:00.000Z',
  };

  beforeEach(async () => {
    const session = signal<SessionData | null>({
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        roles: ['ADMIN'],
        permissions: ['INVENTORY_VIEW', 'INVENTORY_ADJUST'],
      },
      tenant: { id: 'tenant-1', name: 'Tienda' },
      context: {
        branch: { id: 'branch-1', name: 'Sucursal' },
        warehouse: { id: 'warehouse-1', name: 'Bodega' },
        cashRegister: null,
      },
      nextStep: 'APPLICATION',
    });
    inventory = {
      listStockAlerts: vi.fn().mockReturnValue(
        of({
          data: [alert],
          meta: {
            apiVersion: '1' as const,
            defaultThreshold: '5.000',
            scope: {
              branch: { id: 'branch-1', name: 'Sucursal' },
              warehouse: { id: 'warehouse-1', name: 'Bodega' },
            },
            pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
          },
        }),
      ),
      setStockAlertThreshold: vi.fn().mockReturnValue(
        of({
          data: { ...alert, threshold: '7.000' },
          meta: { apiVersion: '1' as const, defaultThreshold: '5.000' },
        }),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [StockAlertPanelComponent],
      providers: [
        { provide: InventoryApiService, useValue: inventory },
        { provide: SessionApiService, useValue: { session } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(StockAlertPanelComponent);
    fixture.componentRef.setInput('products', [
      {
        product: {
          id: 'product-1',
          name: 'Café',
          sku: 'CAFE-1',
          active: true,
          trackLots: false,
        },
      } as InventoryStockItem,
    ]);
    fixture.componentRef.setInput('locations', [alert.location]);
    fixture.detectChanges();
  });

  it('filters operational alerts, links stock and saves a location threshold', () => {
    expect(fixture.nativeElement.textContent).toContain('Stock bajo');
    expect(fixture.nativeElement.textContent).toContain('CAFE-1');
    expect(fixture.nativeElement.textContent).toContain('Umbral predeterminado: 5.000');

    const emitted: string[] = [];
    fixture.componentInstance.viewStock.subscribe((sku) => emitted.push(sku));
    (fixture.nativeElement.querySelector('article button') as HTMLButtonElement).click();
    expect(emitted).toEqual(['CAFE-1']);

    const selects = fixture.nativeElement.querySelectorAll('.threshold select');
    selects[0].value = 'product-1';
    selects[0].dispatchEvent(new Event('change'));
    selects[1].value = 'location-1';
    selects[1].dispatchEvent(new Event('change'));
    const threshold = fixture.nativeElement.querySelector('.threshold input') as HTMLInputElement;
    threshold.value = '7';
    threshold.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('.threshold') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    fixture.detectChanges();

    expect(inventory.setStockAlertThreshold).toHaveBeenCalledWith('product-1', 'location-1', '7');
    expect(fixture.nativeElement.textContent).toContain(
      'Umbral 7.000 guardado para Café en General.',
    );

    const status = fixture.nativeElement.querySelector('.filters select') as HTMLSelectElement;
    status.value = 'LOW';
    status.dispatchEvent(new Event('change'));
    (fixture.nativeElement.querySelector('.filters') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    expect(inventory.listStockAlerts).toHaveBeenLastCalledWith({
      status: 'LOW',
      page: 1,
      pageSize: 10,
    });
  });
});
