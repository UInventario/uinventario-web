import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { ProductApiService, ProductData } from '../catalog/product-api.service';
import { SupplierApiService, SupplierData } from './supplier-api.service';
import { SupplierProductApiService, SupplierProductData } from './supplier-product-api.service';
import { SupplierPanelComponent } from './supplier-panel.component';

describe('SupplierPanelComponent', () => {
  let fixture: ComponentFixture<SupplierPanelComponent>;
  let api: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    deactivate: ReturnType<typeof vi.fn>;
  };
  let productApi: { list: ReturnType<typeof vi.fn> };
  let supplierProductApi: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  const supplier: SupplierData = {
    id: 'supplier',
    legalName: 'Café Mayorista, S.A. de C.V.',
    tradeName: 'Café Mayorista',
    countryCode: 'MX',
    identifierType: 'RFC',
    taxIdentifier: 'ABC010203AB1',
    active: true,
    version: 1,
    contacts: [
      {
        id: 'contact',
        name: 'Ana Compras',
        email: 'ana@proveedor.example',
        phone: null,
        role: 'Ventas',
        primary: true,
      },
    ],
    createdAt: '2026-08-27T15:00:00.000Z',
    updatedAt: '2026-08-27T15:00:00.000Z',
  };
  const product: ProductData = {
    id: 'product',
    name: 'Café molido',
    sku: 'CAFE-500',
    barcode: null,
    category: null,
    brand: null,
    cost: '85.40',
    price: '119.90',
    active: true,
    version: 1,
  };
  const supplierProduct: SupplierProductData = {
    id: 'supplier-product',
    supplier: { id: supplier.id, name: supplier.tradeName! },
    product: {
      id: product.id,
      name: product.name,
      sku: product.sku,
      catalogCost: product.cost,
      catalogPrice: product.price,
    },
    supplierCode: 'PROV-CAFE',
    minimumQuantity: '12.000',
    active: true,
    version: 1,
    prices: [
      {
        id: 'price-1',
        currency: 'MXN',
        unitCost: '80.00',
        validFrom: '2026-08-01',
        validTo: null,
        createdAt: '2026-08-27T15:00:00.000Z',
      },
    ],
    createdAt: '2026-08-27T15:00:00.000Z',
    updatedAt: '2026-08-27T15:00:00.000Z',
  };

  beforeEach(async () => {
    api = {
      list: vi.fn().mockReturnValue(
        of({
          data: [supplier],
          meta: {
            apiVersion: '1',
            pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
          },
        }),
      ),
      create: vi.fn(),
      update: vi.fn(),
      deactivate: vi.fn(),
    };
    productApi = {
      list: vi.fn().mockReturnValue(
        of({
          data: [product],
          meta: {
            apiVersion: '1',
            pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
          },
        }),
      ),
    };
    supplierProductApi = {
      list: vi.fn().mockReturnValue(
        of({
          data: [supplierProduct],
          meta: {
            apiVersion: '1',
            pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
          },
        }),
      ),
      create: vi.fn(),
      update: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [SupplierPanelComponent],
      providers: [
        { provide: SupplierApiService, useValue: api },
        { provide: ProductApiService, useValue: productApi },
        { provide: SupplierProductApiService, useValue: supplierProductApi },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SupplierPanelComponent);
    fixture.detectChanges();
  });

  function fill(id: string, value: string): void {
    const input = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('renders, filters and creates a supplier with a contact', () => {
    expect(api.list).toHaveBeenCalledWith({ status: 'ACTIVE', page: 1, pageSize: 10 });
    expect(api.list).toHaveBeenCalledWith({ status: 'ACTIVE', page: 1, pageSize: 100 });
    expect(fixture.nativeElement.textContent).toContain('Café Mayorista');
    expect(fixture.nativeElement.textContent).toContain('ana@proveedor.example');

    fill('supplierSearch', '  Ana  ');
    (fixture.componentInstance as unknown as { filter(): void }).filter();
    expect(api.list).toHaveBeenLastCalledWith({
      q: 'Ana',
      status: 'ACTIVE',
      page: 1,
      pageSize: 10,
    });

    fill('supplierLegalName', 'Proveedor Nuevo');
    fill('supplierTradeName', 'Nuevo');
    fill('supplierTaxIdentifier', 'DEF040506CD2');
    fill('supplierContactName0', 'Luis Ventas');
    fill('supplierContactEmail0', 'luis@example.com');
    const response = new Subject<{
      data: SupplierData;
      meta: { apiVersion: '1' };
    }>();
    api.create.mockReturnValue(response);

    (fixture.componentInstance as unknown as { submit(): void }).submit();
    (fixture.componentInstance as unknown as { submit(): void }).submit();

    expect(api.create).toHaveBeenCalledOnce();
    expect(api.create).toHaveBeenCalledWith({
      legalName: 'Proveedor Nuevo',
      tradeName: 'Nuevo',
      taxIdentifier: 'DEF040506CD2',
      contacts: [
        {
          name: 'Luis Ventas',
          email: 'luis@example.com',
          primary: false,
        },
      ],
    });
    response.next({
      data: { ...supplier, legalName: 'Proveedor Nuevo' },
      meta: { apiVersion: '1' },
    });
    response.complete();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Proveedor creado.');
    expect(api.list).toHaveBeenLastCalledWith({ status: 'ACTIVE', page: 1, pageSize: 100 });
  });

  it('updates with optimistic version and deactivates without deleting history', () => {
    const buttons = fixture.nativeElement.querySelectorAll(
      '.results li button',
    ) as NodeListOf<HTMLButtonElement>;
    buttons[0].click();
    fixture.detectChanges();
    expect(
      (fixture.nativeElement.querySelector('#supplierLegalName') as HTMLInputElement).value,
    ).toBe(supplier.legalName);

    fill('supplierLegalName', 'Café Mayorista Actualizado');
    api.update.mockReturnValue(
      of({
        data: { ...supplier, legalName: 'Café Mayorista Actualizado', version: 2 },
        meta: { apiVersion: '1' },
      }),
    );
    (fixture.componentInstance as unknown as { submit(): void }).submit();

    expect(api.update).toHaveBeenCalledWith(
      supplier.id,
      expect.objectContaining({ legalName: 'Café Mayorista Actualizado', version: 1 }),
    );

    api.deactivate.mockReturnValue(
      of({ data: { ...supplier, active: false, version: 2 }, meta: { apiVersion: '1' } }),
    );
    (fixture.componentInstance as unknown as { deactivate(value: SupplierData): void }).deactivate(
      supplier,
    );
    fixture.detectChanges();

    expect(api.deactivate).toHaveBeenCalledWith(supplier.id);
    expect(fixture.nativeElement.textContent).toContain(
      'Proveedor desactivado; su historial se conserva.',
    );
  });

  it('creates a supplier product and appends a new price while showing history', () => {
    expect(productApi.list).toHaveBeenCalledWith({ status: 'ACTIVE', page: 1, pageSize: 100 });
    expect(fixture.nativeElement.textContent).toContain('PROV-CAFE');
    expect(fixture.nativeElement.textContent).toContain('MXN 80.00');

    const component = fixture.componentInstance as unknown as {
      supplierProductForm: {
        setValue(value: Record<string, string>): void;
      };
      submitSupplierProduct(): void;
      editSupplierProduct(link: SupplierProductData): void;
    };
    component.supplierProductForm.setValue({
      supplierId: supplier.id,
      productId: product.id,
      supplierCode: ' PROV-NUEVO ',
      currency: 'usd',
      unitCost: '77.50',
      minimumQuantity: '24',
      validFrom: '2026-09-01',
      validTo: '',
    });
    supplierProductApi.create.mockReturnValue(
      of({ data: supplierProduct, meta: { apiVersion: '1' } }),
    );
    component.submitSupplierProduct();
    expect(supplierProductApi.create).toHaveBeenCalledWith({
      supplierId: supplier.id,
      productId: product.id,
      supplierCode: 'PROV-NUEVO',
      currency: 'USD',
      unitCost: '77.50',
      minimumQuantity: '24',
      validFrom: '2026-09-01',
    });

    component.editSupplierProduct(supplierProduct);
    component.supplierProductForm.setValue({
      supplierId: supplier.id,
      productId: product.id,
      supplierCode: supplierProduct.supplierCode,
      currency: 'MXN',
      unitCost: '75.00',
      minimumQuantity: '12',
      validFrom: '2026-10-01',
      validTo: '',
    });
    supplierProductApi.update.mockReturnValue(
      of({ data: { ...supplierProduct, version: 2 }, meta: { apiVersion: '1' } }),
    );
    component.submitSupplierProduct();
    expect(supplierProductApi.update).toHaveBeenCalledWith(
      supplierProduct.id,
      expect.objectContaining({ version: 1, unitCost: '75.00', validFrom: '2026-10-01' }),
    );
  });
});
