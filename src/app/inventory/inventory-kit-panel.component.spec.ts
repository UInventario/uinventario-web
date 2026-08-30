import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProductData } from '../catalog/product-api.service';
import { InventoryApiService } from './inventory-api.service';
import { InventoryKitPanelComponent } from './inventory-kit-panel.component';

describe('InventoryKitPanelComponent', () => {
  let fixture: ComponentFixture<InventoryKitPanelComponent>;
  const product: ProductData = {
    id: 'kit',
    name: 'Kit café',
    sku: 'KIT-CAFE',
    barcode: null,
    category: null,
    brand: null,
    cost: '20.00',
    price: '50.00',
    active: true,
    version: 2,
    kit: {
      stockMode: 'ASSEMBLED',
      priceRule: 'FIXED',
      effectiveFrom: null,
      effectiveTo: null,
      components: [],
    },
  };
  const operation = {
    id: 'operation',
    operationType: 'ASSEMBLE' as const,
    kit: { id: product.id, name: product.name, sku: product.sku },
    locationId: 'location',
    quantity: '2.000',
    components: [],
    createdAt: new Date().toISOString(),
  };
  const api = { operateKit: vi.fn() };

  beforeEach(async () => {
    api.operateKit
      .mockReset()
      .mockReturnValue(of({ data: operation, meta: { idempotentReplay: false } }));
    await TestBed.configureTestingModule({
      imports: [InventoryKitPanelComponent],
      providers: [{ provide: InventoryApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(InventoryKitPanelComponent);
    fixture.componentRef.setInput('product', product);
    fixture.componentRef.setInput('locations', [
      { id: 'location', name: 'Principal', code: 'P-01' },
    ]);
    fixture.detectChanges();
  });

  it('assembles kits with an idempotency key', () => {
    const component = fixture.componentInstance as unknown as {
      quantity: string;
      submit(): void;
    };
    component.quantity = '2';

    component.submit();

    expect(api.operateKit).toHaveBeenCalledWith(
      product.id,
      { operationType: 'ASSEMBLE', locationId: 'location', quantity: '2' },
      expect.any(String),
    );
  });
});
