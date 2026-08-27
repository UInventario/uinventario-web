import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CatalogClassificationPanelComponent } from './catalog-classification-panel.component';
import { ProductApiService } from './product-api.service';

describe('CatalogClassificationPanelComponent', () => {
  let fixture: ComponentFixture<CatalogClassificationPanelComponent>;
  const api = {
    listClassifications: vi.fn(),
    createClassification: vi.fn(),
    updateClassification: vi.fn(),
    deactivateClassification: vi.fn(),
  };

  beforeEach(async () => {
    api.listClassifications.mockImplementation((kind: string) =>
      of({
        data:
          kind === 'categories'
            ? [
                { id: 'category-1', name: 'Bebidas', active: true, productCount: 2 },
                { id: 'category-2', name: 'Despensa', active: true, productCount: 0 },
              ]
            : [{ id: 'brand-1', name: 'Casa', active: false, productCount: 0 }],
      }),
    );
    api.createClassification.mockReturnValue(
      of({ data: { id: 'new', name: 'Nueva', active: true, productCount: 0 } }),
    );
    api.updateClassification.mockReturnValue(
      of({ data: { id: 'brand-1', name: 'Casa', active: true, productCount: 0 } }),
    );
    api.deactivateClassification.mockReturnValue(
      of({
        data: {
          classification: {
            id: 'category-1',
            name: 'Bebidas',
            active: false,
            productCount: 0,
          },
          reassignedProducts: 2,
        },
      }),
    );
    await TestBed.configureTestingModule({
      imports: [CatalogClassificationPanelComponent],
      providers: [{ provide: ProductApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(CatalogClassificationPanelComponent);
    fixture.detectChanges();
  });

  it('loads real classifications and preserves products when deactivating', () => {
    expect(fixture.nativeElement.textContent).toContain('Bebidas');
    expect(fixture.nativeElement.textContent).toContain('2 producto(s)');
    const component = fixture.componentInstance as unknown as {
      deactivate(kind: 'categories', item: unknown, replacementId: string): void;
    };
    component.deactivate(
      'categories',
      { id: 'category-1', name: 'Bebidas', active: true, productCount: 2 },
      'category-2',
    );
    expect(api.deactivateClassification).toHaveBeenCalledWith(
      'categories',
      'category-1',
      'category-2',
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('2 producto(s) conservados');
  });
});
