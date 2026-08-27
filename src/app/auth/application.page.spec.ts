import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { ProductApiService } from '../catalog/product-api.service';
import { InventoryApiService } from '../inventory/inventory-api.service';
import { ApplicationPage } from './application.page';
import { SessionApiService } from './session-api.service';

describe('ApplicationPage', () => {
  let fixture: ComponentFixture<ApplicationPage>;
  let products: {
    getOptions: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };
  let inventory: {
    listLocations: ReturnType<typeof vi.fn>;
    listStock: ReturnType<typeof vi.fn>;
    getBalance: ReturnType<typeof vi.fn>;
    createMovement: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    products = {
      getOptions: vi
        .fn()
        .mockReturnValue(of({ data: { categories: [], brands: [] }, meta: { apiVersion: '1' } })),
      create: vi.fn(),
      list: vi.fn().mockReturnValue(
        of({
          data: [],
          meta: {
            apiVersion: '1',
            pagination: { page: 1, pageSize: 5, total: 0, totalPages: 0 },
          },
        }),
      ),
      get: vi.fn(),
    };
    inventory = {
      listLocations: vi.fn().mockReturnValue(
        of({
          data: [{ id: 'location', name: 'General', code: 'GENERAL' }],
          meta: { apiVersion: '1' },
        }),
      ),
      listStock: vi.fn().mockReturnValue(
        of({
          data: [],
          meta: {
            apiVersion: '1',
            scope: {
              branch: { id: 'branch', name: 'Sucursal' },
              warehouse: { id: 'warehouse', name: 'Bodega' },
            },
            pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
          },
        }),
      ),
      getBalance: vi.fn().mockReturnValue(
        of({
          data: {
            product: { id: 'product', name: 'Café', sku: 'CAFE-1' },
            location: { id: 'location', name: 'General', code: 'GENERAL' },
            quantity: '0.000',
          },
          meta: { apiVersion: '1' },
        }),
      ),
      createMovement: vi.fn(),
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
        { provide: InventoryApiService, useValue: inventory },
        { provide: SessionApiService, useValue: sessions },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ApplicationPage);
    fixture.detectChanges();
  });

  function fill(id: string, value: string): void {
    const input = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
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
    expect(products.list).toHaveBeenLastCalledWith({ page: 1, pageSize: 5 });
  });

  it('searches and opens a tenant-scoped product detail', () => {
    const product = {
      id: 'product',
      name: 'Café',
      sku: 'CAFE-1',
      barcode: '7501',
      category: null,
      brand: null,
      cost: '1.20',
      price: '2.50',
      active: true,
    };
    products.list.mockReturnValue(
      of({
        data: [product],
        meta: {
          apiVersion: '1',
          pagination: { page: 1, pageSize: 5, total: 1, totalPages: 1 },
        },
      }),
    );
    products.get.mockReturnValue(of({ data: product, meta: { apiVersion: '1' } }));
    fill('productSearch', ' café ');
    (fixture.componentInstance as unknown as { search(): void }).search();
    fixture.detectChanges();

    expect(products.list).toHaveBeenLastCalledWith({ q: 'café', page: 1, pageSize: 5 });
    (fixture.nativeElement.querySelector('.product-list button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(products.get).toHaveBeenCalledWith('product');
    expect(fixture.nativeElement.textContent).toContain('Sin categoría');
  });

  it('registers initial stock and shows the persisted balance', () => {
    const product = {
      id: 'product',
      name: 'Café',
      sku: 'CAFE-1',
      barcode: null,
      category: null,
      brand: null,
      cost: '1.20',
      price: '2.50',
      active: true,
    };
    products.list.mockReturnValue(
      of({
        data: [product],
        meta: {
          apiVersion: '1',
          pagination: { page: 1, pageSize: 5, total: 1, totalPages: 1 },
        },
      }),
    );
    products.get.mockReturnValue(of({ data: product, meta: { apiVersion: '1' } }));
    inventory.createMovement
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })))
      .mockReturnValueOnce(
        of({
          data: {
            id: 'movement',
            product: { id: 'product', name: 'Café', sku: 'CAFE-1' },
            location: { id: 'location', name: 'General', code: 'GENERAL' },
            type: 'INITIAL',
            quantityChange: '10.000',
            quantity: '10.000',
            reason: 'Conteo inicial',
            reference: null,
            createdAt: new Date().toISOString(),
          },
          meta: { apiVersion: '1', idempotentReplay: false },
        }),
      );
    inventory.listStock.mockReturnValue(
      of({
        data: [
          {
            product: { id: 'product', name: 'Café', sku: 'CAFE-1', active: true },
            availableQuantity: '10.000',
            totalQuantity: '10.000',
            states: [{ code: 'AVAILABLE', quantity: '10.000' }],
          },
        ],
        meta: {
          apiVersion: '1',
          scope: {
            branch: { id: 'branch', name: 'Sucursal' },
            warehouse: { id: 'warehouse', name: 'Bodega' },
          },
          pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
        },
      }),
    );
    (fixture.componentInstance as unknown as { search(): void }).search();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.product-list button') as HTMLButtonElement).click();
    fixture.detectChanges();
    fill('stockQuantity', '10');
    fill('stockReason', 'Conteo inicial');
    (fixture.nativeElement.querySelector('.stock-card form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No pudimos conectar');
    (fixture.componentInstance as unknown as { recordMovement(): void }).recordMovement();
    fixture.detectChanges();

    expect(inventory.createMovement).toHaveBeenCalledWith(
      {
        productId: 'product',
        locationId: 'location',
        type: 'INITIAL',
        quantity: '10',
        reason: 'Conteo inicial',
      },
      expect.stringMatching(/^web-/),
    );
    expect(inventory.createMovement.mock.calls[1][1]).toBe(
      inventory.createMovement.mock.calls[0][1],
    );
    expect(fixture.nativeElement.textContent).toContain('Existencia 10.000');
    expect(fixture.nativeElement.querySelector('.stock-table').textContent).toContain('CAFE-1');
  });

  it('shows an error when the stock overview cannot be loaded', () => {
    inventory.listStock.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    (fixture.componentInstance as unknown as { searchStock(): void }).searchStock();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No fue posible cargar las existencias.');
  });
});
