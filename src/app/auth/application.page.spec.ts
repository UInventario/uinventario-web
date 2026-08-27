import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ProductApiService } from '../catalog/product-api.service';
import { ApplicationPage } from './application.page';
import { SessionApiService } from './session-api.service';

describe('ApplicationPage', () => {
  let fixture: ComponentFixture<ApplicationPage>;
  let products: { getOptions: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    products = {
      getOptions: vi.fn().mockReturnValue(
        of({ data: { categories: [], brands: [] }, meta: { apiVersion: '1' } }),
      ),
      create: vi.fn(),
    };
    const sessions = {
      session: signal({
        user: { id: 'user', email: 'admin@example.com', roles: ['ADMIN'], permissions: [] },
        tenant: { id: 'tenant', name: 'Tienda' },
        context: {
          branch: { id: 'branch', name: 'Sucursal' },
          warehouse: { id: 'warehouse', name: 'Bodega' },
          cashRegister: { id: 'register', name: 'Caja', code: 'MAIN' },
        },
        nextStep: 'APPLICATION',
      }),
      logout: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [ApplicationPage],
      providers: [
        { provide: ProductApiService, useValue: products },
        { provide: SessionApiService, useValue: sessions },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ApplicationPage);
    fixture.detectChanges();
  });

  function fill(id: string, value: string): void {
    const input = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function submit(): void {
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    fixture.detectChanges();
  }

  it('rejects negative money before calling the API', () => {
    fill('name', 'Café');
    fill('sku', 'CAFE-1');
    fill('cost', '-1');
    fill('price', '2.00');
    submit();

    expect(products.create).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Escribe un costo no negativo');
  });

  it('creates a product with optional classifications', () => {
    products.create.mockReturnValue(
      of({
        data: {
          id: 'product',
          name: 'Café',
          sku: 'CAFE-1',
          barcode: null,
          category: { id: 'category', name: 'Abarrotes' },
          brand: { id: 'brand', name: 'Casa' },
          cost: '1.20',
          price: '2.50',
          active: true,
        },
        meta: { apiVersion: '1' },
      }),
    );
    fill('name', ' Café ');
    fill('sku', 'CAFE-1');
    fill('categoryName', 'Abarrotes');
    fill('brandName', 'Casa');
    fill('cost', '1.20');
    fill('price', '2.50');
    submit();

    expect(products.create).toHaveBeenCalledWith({
      name: 'Café',
      sku: 'CAFE-1',
      categoryName: 'Abarrotes',
      brandName: 'Casa',
      cost: '1.20',
      price: '2.50',
    });
    expect(fixture.nativeElement.textContent).toContain('Producto creado');
  });
});
