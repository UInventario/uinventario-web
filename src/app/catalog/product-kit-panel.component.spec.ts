import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProductApiService, ProductData } from './product-api.service';
import { ProductKitPanelComponent } from './product-kit-panel.component';

describe('ProductKitPanelComponent', () => {
  let fixture: ComponentFixture<ProductKitPanelComponent>;
  const componentProduct: ProductData = {
    id: 'kit',
    name: 'Kit café',
    sku: 'KIT-CAFE',
    barcode: null,
    baseUnit: 'UNIT',
    quantityPrecision: 0,
    minimumQuantity: '1.000',
    trackLots: false,
    trackSerials: false,
    category: null,
    brand: null,
    cost: '20.00',
    price: '50.00',
    active: true,
    version: 1,
  };
  const coffee: ProductData = {
    ...componentProduct,
    id: 'coffee',
    name: 'Café',
    sku: 'CAFE',
  };
  const configured: ProductData = {
    ...componentProduct,
    version: 2,
    kit: {
      stockMode: 'DERIVED',
      priceRule: 'COMPONENT_SUM',
      effectiveFrom: null,
      effectiveTo: null,
      components: [
        { product: { id: coffee.id, name: coffee.name, sku: coffee.sku }, quantity: '0.500' },
      ],
    },
  };
  const api = { list: vi.fn(), updateKit: vi.fn() };

  beforeEach(async () => {
    api.list.mockReset().mockReturnValue(of({ data: [coffee], meta: {} }));
    api.updateKit.mockReset().mockReturnValue(of({ data: configured }));
    await TestBed.configureTestingModule({
      imports: [ProductKitPanelComponent],
      providers: [{ provide: ProductApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(ProductKitPanelComponent);
    fixture.componentRef.setInput('product', componentProduct);
    fixture.detectChanges();
  });

  it('saves a derived kit with its component quantities', () => {
    const component = fixture.componentInstance as unknown as {
      enabled: boolean;
      stockMode: 'DERIVED';
      priceRule: 'COMPONENT_SUM';
      components: Array<{ productId: string; quantity: string }>;
      save(): void;
    };
    component.enabled = true;
    component.stockMode = 'DERIVED';
    component.priceRule = 'COMPONENT_SUM';
    component.components = [{ productId: coffee.id, quantity: '0.500' }];

    component.save();

    expect(api.updateKit).toHaveBeenCalledWith(componentProduct.id, {
      version: 1,
      enabled: true,
      stockMode: 'DERIVED',
      priceRule: 'COMPONENT_SUM',
      components: [{ productId: coffee.id, quantity: '0.500' }],
    });
  });
});
