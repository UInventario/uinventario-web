import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import {
  InventoryActivityReportApiService,
  InventoryActivityReportData,
} from './inventory-activity-report-api.service';
import { InventoryActivityReportComponent } from './inventory-activity-report.component';

describe('InventoryActivityReportComponent', () => {
  let fixture: ComponentFixture<InventoryActivityReportComponent>;
  let inventory: {
    report: ReturnType<typeof vi.fn>;
    movements: ReturnType<typeof vi.fn>;
  };

  const report: InventoryActivityReportData = {
    period: { dateFrom: '2026-08-01', dateTo: '2026-08-29', timezone: 'BRANCH_LOCAL' },
    scope: {
      branches: [
        { id: 'branch-1', name: 'Centro', timezone: 'America/Mexico_City' },
        { id: 'branch-2', name: 'Norte', timezone: 'America/Mexico_City' },
      ],
      warehouses: [
        { id: 'warehouse-1', name: 'Principal', branch: { id: 'branch-1', name: 'Centro' } },
        { id: 'warehouse-2', name: 'Secundaria', branch: { id: 'branch-2', name: 'Norte' } },
      ],
    },
    filters: { categories: [{ id: 'category-1', name: 'Bebidas' }] },
    definitions: {
      rotation: 'Venta neta / stock promedio.',
      loss: 'LOSS y DAMAGE.',
      period: 'Días locales completos.',
      returnsAndVoids: 'Reducen la venta neta.',
      transfers: 'Sólo actividad.',
    },
    items: [
      {
        product: {
          id: 'product-1',
          name: 'Café lento',
          sku: 'CAFE-1',
          category: { id: 'category-1', name: 'Bebidas' },
        },
        openingQuantity: '10.000',
        closingQuantity: '8.000',
        averageQuantity: '9.000',
        netSoldQuantity: '0.000',
        lossQuantity: '2.000',
        activityQuantity: '4.000',
        rotation: 0,
        status: 'SLOW',
        lastMovementAt: '2026-08-28T12:00:00.000Z',
      },
    ],
    total: 1,
  };

  beforeEach(async () => {
    inventory = {
      report: vi.fn().mockReturnValue(
        of({
          data: report,
          meta: {
            apiVersion: '1',
            pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
          },
        }),
      ),
      movements: vi.fn().mockReturnValue(
        of({
          data: [
            {
              id: 'movement-1',
              type: 'LOSS',
              quantityChange: '-2.000',
              resultingQuantity: '8.000',
              reason: 'Merma confirmada',
              reference: 'MERMA-1',
              occurredAt: '2026-08-28T12:00:00.000Z',
              branchName: 'Centro',
              warehouseName: 'Principal',
              locationName: 'General',
            },
          ],
          meta: {
            apiVersion: '1',
            pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
          },
        }),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [InventoryActivityReportComponent],
      providers: [
        provideRouter([]),
        { provide: InventoryActivityReportApiService, useValue: inventory },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(InventoryActivityReportComponent);
    fixture.detectChanges();
  });

  it('shows understandable metrics, applies filters and drills down to movements', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Producto lento');
    expect(text).toContain('Venta neta / stock promedio.');
    expect(text).toContain('2.000');

    const dates = fixture.nativeElement.querySelectorAll('input[type="date"]');
    dates[0].value = '2026-08-01';
    dates[0].dispatchEvent(new Event('input'));
    dates[1].value = '2026-08-29';
    dates[1].dispatchEvent(new Event('input'));
    const selects = fixture.nativeElement.querySelectorAll('.filters select');
    selects[0].value = 'branch-1';
    selects[0].dispatchEvent(new Event('change'));
    selects[1].value = 'warehouse-1';
    selects[1].dispatchEvent(new Event('change'));
    selects[2].value = 'category-1';
    selects[2].dispatchEvent(new Event('change'));
    const product = fixture.nativeElement.querySelector(
      '.filters input:not([type="date"])',
    ) as HTMLInputElement;
    product.value = 'CAFE';
    product.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('.filters') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );

    expect(inventory.report).toHaveBeenLastCalledWith({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-29',
      branchId: 'branch-1',
      warehouseId: 'warehouse-1',
      categoryId: 'category-1',
      product: 'CAFE',
      page: 1,
      pageSize: 20,
    });

    (fixture.nativeElement.querySelector('article button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(inventory.movements).toHaveBeenCalledWith(
      'product-1',
      expect.objectContaining({
        dateFrom: '2026-08-01',
        branchId: 'branch-1',
        warehouseId: 'warehouse-1',
        page: 1,
        pageSize: 10,
      }),
    );
    expect(fixture.nativeElement.textContent).toContain('Merma confirmada');
    expect(fixture.nativeElement.textContent).toContain('Centro · Principal · General');
  });
});
