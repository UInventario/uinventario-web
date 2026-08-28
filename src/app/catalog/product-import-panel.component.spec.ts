import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProductApiService, ProductImportData } from './product-api.service';
import { ProductImportPanelComponent } from './product-import-panel.component';

describe('ProductImportPanelComponent', () => {
  let fixture: ComponentFixture<ProductImportPanelComponent>;
  const data: ProductImportData = {
    id: 'import',
    status: 'PREVIEWED',
    policy: 'ATOMIC',
    templateVersion: '1.0',
    sourceFilename: 'productos.csv',
    summary: { rows: 2, creates: 1, updates: 1, unchanged: 0, errors: 0 },
    canConfirm: true,
    rows: [
      {
        id: 'row',
        rowNumber: 2,
        action: 'CREATE',
        name: 'Té',
        sku: 'TE-1',
        barcode: null,
        category: 'Bebidas',
        brand: null,
        cost: '10.00',
        price: '20.00',
        active: true,
        errors: [],
      },
    ],
  };
  const api = { previewImport: vi.fn(), confirmImport: vi.fn(), importResult: vi.fn() };

  beforeEach(async () => {
    api.previewImport.mockReturnValue(of({ data }));
    api.confirmImport.mockReturnValue(of({ data: { ...data, status: 'CONFIRMED' } }));
    await TestBed.configureTestingModule({
      imports: [ProductImportPanelComponent],
      providers: [{ provide: ProductApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(ProductImportPanelComponent);
    fixture.detectChanges();
  });

  it('previews create/update counts and confirms the atomic batch', () => {
    const file = new File(['name,sku'], 'productos.csv', { type: 'text/csv' });
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll(
      'button',
    ) as NodeListOf<HTMLButtonElement>;
    [...buttons].find((button) => button.textContent?.includes('Generar'))!.click();
    fixture.detectChanges();
    expect(api.previewImport).toHaveBeenCalledWith(file);
    expect(fixture.nativeElement.textContent).toContain('1 alta(s)');
    [...fixture.nativeElement.querySelectorAll('button')]
      .find((button: HTMLButtonElement) => button.textContent?.includes('Confirmar'))
      .click();
    expect(api.confirmImport).toHaveBeenCalledWith(
      'import',
      expect.stringContaining('web-product-import-'),
    );
  });
});
