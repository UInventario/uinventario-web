import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProductApiService, ProductData } from './product-api.service';
import { ProductVariantPanelComponent } from './product-variant-panel.component';

describe('ProductVariantPanelComponent', () => {
  let fixture: ComponentFixture<ProductVariantPanelComponent>;
  const product: ProductData = {
    id: 'product-parent',
    name: 'Playera',
    sku: 'PLAYERA',
    barcode: null,
    category: null,
    brand: null,
    cost: '80.00',
    price: '149.00',
    active: true,
    version: 1,
    sellable: true,
    variantAttributes: [],
    variantValues: [],
    variants: [],
  };
  const configured: ProductData = {
    ...product,
    version: 2,
    sellable: false,
    variantAttributes: [
      { name: 'Color', values: ['Rojo', 'Azul'] },
      { name: 'Talla', values: ['CH', 'M'] },
    ],
  };
  const api = { updateVariants: vi.fn() };

  beforeEach(async () => {
    api.updateVariants.mockReset().mockReturnValue(of({ data: configured }));
    await TestBed.configureTestingModule({
      imports: [ProductVariantPanelComponent],
      providers: [{ provide: ProductApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(ProductVariantPanelComponent);
    fixture.componentRef.setInput('product', product);
    fixture.detectChanges();
  });

  it('generates the cartesian combinations and saves independent commercial data', () => {
    const component = fixture.componentInstance as unknown as {
      attributes: Array<{ name: string; valuesText: string }>;
      variants: Array<{ sku: string; values: string[] }>;
      rebuild(): void;
      save(): void;
    };
    component.attributes = [
      { name: 'Color', valuesText: 'Rojo, Azul' },
      { name: 'Talla', valuesText: 'CH, M' },
    ];
    component.rebuild();
    expect(component.variants.map(({ values }) => values)).toEqual([
      ['Rojo', 'CH'],
      ['Rojo', 'M'],
      ['Azul', 'CH'],
      ['Azul', 'M'],
    ]);
    expect(new Set(component.variants.map(({ sku }) => sku)).size).toBe(4);

    component.save();

    expect(api.updateVariants).toHaveBeenCalledWith(
      product.id,
      expect.objectContaining({
        version: 1,
        attributes: [
          { name: 'Color', values: ['Rojo', 'Azul'] },
          { name: 'Talla', values: ['CH', 'M'] },
        ],
        variants: expect.arrayContaining([
          expect.objectContaining({ values: ['Rojo', 'CH'], cost: '80.00', price: '149.00' }),
        ]),
      }),
    );
  });
});
