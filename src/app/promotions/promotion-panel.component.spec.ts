import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProductApiService } from '../catalog/product-api.service';
import { CustomerApiService } from '../customers/customer-api.service';
import { OrganizationApiService } from '../organization/organization-api.service';
import { PromotionApiService } from './promotion-api.service';
import { PromotionPanelComponent } from './promotion-panel.component';

describe('PromotionPanelComponent', () => {
  let fixture: ComponentFixture<PromotionPanelComponent>;
  const api = {
    list: vi.fn(() => of({ data: [], meta: { apiVersion: '1' as const } })),
    create: vi.fn(() => of({ data: {}, meta: { apiVersion: '1' as const } })),
    update: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [PromotionPanelComponent],
      providers: [
        { provide: PromotionApiService, useValue: api },
        {
          provide: ProductApiService,
          useValue: {
            list: () =>
              of({
                data: [
                  {
                    id: 'product-1',
                    name: 'Café',
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
            list: () => of({ data: [], meta: { apiVersion: '1' } }),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PromotionPanelComponent);
    fixture.detectChanges();
  });

  it('creates a POS 2x1 rule with explicit scope and deterministic priority', () => {
    const set = (selector: string, value: string) => {
      const element = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('#promotionName', '2x1 café');
    set('#promotionPriority', '100');
    set('#promotionProduct0', 'product-1');
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true }),
    );

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '2x1 café',
        type: 'BUY_X_GET_Y',
        channel: 'POS',
        priority: 100,
        stackable: false,
        discountPercent: '100',
        buyQuantity: '1',
        rewardQuantity: '1',
        products: [{ productId: 'product-1', quantity: '1' }],
        tiers: [],
      }),
    );
  });
});
