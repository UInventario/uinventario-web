import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProductApiService } from '../catalog/product-api.service';
import { CustomerApiService } from '../customers/customer-api.service';
import { OrganizationApiService } from '../organization/organization-api.service';
import { PriceListApiService } from './price-list-api.service';
import { PriceListPanelComponent } from './price-list-panel.component';

describe('PriceListPanelComponent', () => {
  let fixture: ComponentFixture<PriceListPanelComponent>;
  const api = {
    list: vi.fn(() => of({ data: [], meta: { apiVersion: '1' as const } })),
    create: vi.fn(() => of({ data: {}, meta: { apiVersion: '1' as const } })),
    update: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [PriceListPanelComponent],
      providers: [
        { provide: PriceListApiService, useValue: api },
        {
          provide: ProductApiService,
          useValue: {
            list: () =>
              of({
                data: [
                  {
                    id: 'product-1',
                    name: 'Cafe',
                    sku: 'CAFE-1',
                    price: '120.00',
                    cost: '80.00',
                    barcode: null,
                    category: null,
                    brand: null,
                    active: true,
                    version: 1,
                  },
                ],
                meta: {
                  apiVersion: '1',
                  pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
                },
              }),
          },
        },
        {
          provide: CustomerApiService,
          useValue: {
            list: () =>
              of({ data: [], meta: { apiVersion: '1', pagination: { total: 0, totalPages: 0 } } }),
          },
        },
        {
          provide: OrganizationApiService,
          useValue: {
            list: () =>
              of({
                data: [
                  { id: 'branch-1', name: 'Centro', timezone: 'UTC', active: true, warehouses: [] },
                ],
                meta: { apiVersion: '1' },
              }),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PriceListPanelComponent);
    fixture.detectChanges();
  });

  it('creates an explicit scoped list with product prices', () => {
    const set = (selector: string, value: string) => {
      const element = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('#priceListName', 'Mayoreo centro');
    set('#priceListBranch', 'branch-1');
    set('#priceListProduct0', 'product-1');
    set('#priceListPrice0', '99.99');
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true }),
    );
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Mayoreo centro',
        currency: 'MXN',
        branchId: 'branch-1',
        channel: 'POS',
        priority: 0,
        active: true,
        items: [{ productId: 'product-1', price: '99.99' }],
      }),
    );
  });
});
