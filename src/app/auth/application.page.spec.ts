import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { ProductApiService } from '../catalog/product-api.service';
import { InventoryApiService } from '../inventory/inventory-api.service';
import { CashSaleData, PosApiService } from '../pos/pos-api.service';
import { ApplicationPage } from './application.page';
import { SessionApiService, SessionData } from './session-api.service';
import { AuditApiService } from '../audit/audit-api.service';
import { OrganizationApiService } from '../organization/organization-api.service';
import { InventoryTransferApiService } from '../inventory/inventory-transfer-api.service';

describe('ApplicationPage', () => {
  let fixture: ComponentFixture<ApplicationPage>;
  let products: {
    getOptions: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    retire: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };
  let inventory: {
    listLocations: ReturnType<typeof vi.fn>;
    listStock: ReturnType<typeof vi.fn>;
    listMovements: ReturnType<typeof vi.fn>;
    getBalance: ReturnType<typeof vi.fn>;
    createMovement: ReturnType<typeof vi.fn>;
    createStateTransition: ReturnType<typeof vi.fn>;
  };
  let pos: {
    quote: ReturnType<typeof vi.fn>;
    createCashSale: ReturnType<typeof vi.fn>;
    listSales: ReturnType<typeof vi.fn>;
    getSale: ReturnType<typeof vi.fn>;
  };
  let audit: { list: ReturnType<typeof vi.fn> };
  let organization: {
    list: ReturnType<typeof vi.fn>;
    createBranch: ReturnType<typeof vi.fn>;
    updateBranch: ReturnType<typeof vi.fn>;
    retireBranch: ReturnType<typeof vi.fn>;
    createWarehouse: ReturnType<typeof vi.fn>;
    updateWarehouse: ReturnType<typeof vi.fn>;
    retireWarehouse: ReturnType<typeof vi.fn>;
  };
  let transfers: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    dispatch: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };
  let sessions: {
    session: ReturnType<typeof signal<SessionData | null>>;
    logout: ReturnType<typeof vi.fn>;
    changeContext: ReturnType<typeof vi.fn>;
  };
  let sessionState: ReturnType<typeof signal<SessionData | null>>;

  beforeEach(async () => {
    products = {
      getOptions: vi
        .fn()
        .mockReturnValue(of({ data: { categories: [], brands: [] }, meta: { apiVersion: '1' } })),
      create: vi.fn(),
      update: vi.fn(),
      retire: vi.fn(),
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
      listMovements: vi.fn().mockReturnValue(
        of({
          data: [],
          meta: {
            apiVersion: '1',
            scope: { branch: { id: 'branch', name: 'Sucursal' } },
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
      createStateTransition: vi.fn(),
    };
    pos = {
      quote: vi.fn(),
      createCashSale: vi.fn(),
      listSales: vi.fn().mockReturnValue(
        of({
          data: [],
          meta: {
            apiVersion: '1',
            pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
          },
        }),
      ),
      getSale: vi.fn(),
    };
    audit = {
      list: vi.fn().mockReturnValue(
        of({
          data: [],
          meta: {
            apiVersion: '1',
            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
          },
        }),
      ),
    };
    organization = {
      list: vi.fn().mockReturnValue(
        of({
          data: [
            {
              id: 'branch',
              name: 'Sucursal',
              timezone: 'America/Mexico_City',
              active: true,
              warehouses: [
                {
                  id: 'warehouse',
                  name: 'Bodega',
                  active: true,
                  locations: [{ id: 'location', name: 'General', code: 'GENERAL', active: true }],
                },
              ],
            },
          ],
          meta: { apiVersion: '1' },
        }),
      ),
      createBranch: vi.fn(),
      updateBranch: vi.fn(),
      retireBranch: vi.fn(),
      createWarehouse: vi.fn(),
      updateWarehouse: vi.fn(),
      retireWarehouse: vi.fn(),
    };
    transfers = {
      list: vi.fn().mockReturnValue(of({ data: [], meta: { apiVersion: '1' } })),
      create: vi.fn(),
      dispatch: vi.fn(),
      cancel: vi.fn(),
    };
    sessionState = signal<SessionData | null>({
      user: {
        id: 'user',
        email: 'admin@example.com',
        roles: ['ADMIN'],
        permissions: ['TENANT_MANAGE', 'PRODUCTS_MANAGE', 'STOCK_MANAGE', 'SALES_MANAGE'],
      },
      tenant: { id: 'tenant', name: 'Tienda' },
      context: {
        branch: { id: 'branch', name: 'Sucursal' },
        warehouse: { id: 'warehouse', name: 'Bodega' },
        cashRegister: { id: 'register', name: 'Caja', code: 'MAIN' },
      },
      nextStep: 'APPLICATION',
    });
    sessions = {
      session: sessionState,
      logout: vi.fn(),
      changeContext: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [ApplicationPage],
      providers: [
        provideRouter([]),
        { provide: ProductApiService, useValue: products },
        { provide: InventoryApiService, useValue: inventory },
        { provide: PosApiService, useValue: pos },
        { provide: AuditApiService, useValue: audit },
        { provide: OrganizationApiService, useValue: organization },
        { provide: InventoryTransferApiService, useValue: transfers },
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
    (fixture.nativeElement.querySelector('.catalog-product-form') as HTMLFormElement).dispatchEvent(
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

  it('creates a branch and switches inventory to its warehouse context', () => {
    const secondBranch = {
      id: 'branch-north',
      name: 'Sucursal Norte',
      timezone: 'America/Monterrey',
      active: true,
      warehouses: [
        {
          id: 'warehouse-north',
          name: 'Bodega Norte',
          active: true,
          locations: [{ id: 'location-north', name: 'General Norte', code: 'NORTE', active: true }],
        },
      ],
    };
    const organizationResponse = {
      data: [
        {
          id: 'branch',
          name: 'Sucursal',
          timezone: 'America/Mexico_City',
          active: true,
          warehouses: [
            {
              id: 'warehouse',
              name: 'Bodega',
              active: true,
              locations: [{ id: 'location', name: 'General', code: 'GENERAL', active: true }],
            },
          ],
        },
        secondBranch,
      ],
      meta: { apiVersion: '1' },
    };
    organization.list.mockReturnValue(of(organizationResponse));
    organization.createBranch.mockReturnValue(
      of({ data: secondBranch, meta: { apiVersion: '1' } }),
    );
    (fixture.componentInstance as unknown as { loadOrganization(): void }).loadOrganization();
    fixture.detectChanges();

    fill('branchName', 'Sucursal Norte');
    fill('branchWarehouseName', 'Bodega Norte');
    fill('branchLocationName', 'General Norte');
    fill('branchLocationCode', 'NORTE');
    (
      (fixture.nativeElement.querySelector('#branchName') as HTMLInputElement).closest(
        'form',
      ) as HTMLFormElement
    ).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(organization.createBranch).toHaveBeenCalledWith({
      name: 'Sucursal Norte',
      timezone: 'America/Mexico_City',
      warehouseName: 'Bodega Norte',
      locationName: 'General Norte',
      locationCode: 'NORTE',
    });

    sessions.changeContext.mockImplementation(() => {
      const data: SessionData = {
        ...sessionState()!,
        context: {
          branch: { id: secondBranch.id, name: secondBranch.name },
          warehouse: { id: secondBranch.warehouses[0].id, name: 'Bodega Norte' },
          cashRegister: null,
        },
      };
      sessionState.set(data);
      return of({
        data,
        meta: { apiVersion: '1', sessionExpiresAt: new Date(Date.now() + 60_000).toISOString() },
      });
    });
    const branchSelect = fixture.nativeElement.querySelector('#contextBranch') as HTMLSelectElement;
    branchSelect.value = secondBranch.id;
    branchSelect.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
    (
      (fixture.nativeElement.querySelector('#contextBranch') as HTMLSelectElement).closest(
        'form',
      ) as HTMLFormElement
    ).dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(sessions.changeContext).toHaveBeenCalledWith('branch-north', 'warehouse-north');
    expect(sessionState()?.context.branch?.id).toBe('branch-north');
    expect(fixture.nativeElement.textContent).toContain('Contexto operativo actualizado.');
  });

  it('filters inactive products explicitly and confirms their safe retirement', () => {
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
      version: 1,
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
    products.retire.mockReturnValue(
      of({
        data: { outcome: 'DEACTIVATED', product: { ...product, active: false, version: 2 } },
        meta: { apiVersion: '1' },
      }),
    );

    const status = fixture.nativeElement.querySelector(
      '[aria-label="Estado del producto"]',
    ) as HTMLSelectElement;
    status.value = 'INACTIVE';
    status.dispatchEvent(new Event('change', { bubbles: true }));
    (fixture.componentInstance as unknown as { search(): void }).search();
    fixture.detectChanges();
    expect(products.list).toHaveBeenLastCalledWith({
      status: 'INACTIVE',
      page: 1,
      pageSize: 5,
    });

    (fixture.nativeElement.querySelector('.product-list button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const buttonWithText = (text: string) =>
      Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
        (button as HTMLButtonElement).textContent?.includes(text),
      ) as HTMLButtonElement;
    buttonWithText('Retirar producto').click();
    fixture.detectChanges();
    expect(products.retire).not.toHaveBeenCalled();
    buttonWithText('Confirmar retiro').click();
    fixture.detectChanges();

    expect(products.retire).toHaveBeenCalledWith('product');
    expect(fixture.nativeElement.textContent).toContain(
      'Producto desactivado; su stock e historial se conservaron.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Confirmar retiro');
  });

  it('loads real data and updates a product with its current version', () => {
    const product = {
      id: 'product',
      name: 'Café',
      sku: 'CAFE-1',
      barcode: '7501',
      category: { id: 'category', name: 'Abarrotes' },
      brand: { id: 'brand', name: 'Casa' },
      cost: '1.20',
      price: '2.50',
      active: true,
      version: 1,
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
    products.update.mockReturnValue(
      of({
        data: { ...product, name: 'Café premium', price: '3.00', version: 2 },
        meta: { apiVersion: '1' },
      }),
    );
    (fixture.componentInstance as unknown as { search(): void }).search();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.product-list button') as HTMLButtonElement).click();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.detail button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('#name') as HTMLInputElement).value).toBe('Café');
    fill('name', 'Café premium');
    fill('price', '3.00');
    submit();

    expect(products.update).toHaveBeenCalledWith('product', {
      name: 'Café premium',
      sku: 'CAFE-1',
      barcode: '7501',
      categoryName: 'Abarrotes',
      brandName: 'Casa',
      cost: '1.20',
      price: '3.00',
      version: 1,
    });
    expect(fixture.nativeElement.textContent).toContain('Producto actualizado');
  });

  it('filters the read-only inventory movement history', () => {
    inventory.listMovements.mockReturnValue(
      of({
        data: [
          {
            id: 'movement',
            type: 'SALE',
            direction: 'OUT',
            quantityChange: '-1.000',
            resultingQuantity: '9.000',
            reason: 'Venta V-1',
            reference: 'V-1',
            createdAt: '2026-08-27T10:00:00.000Z',
            product: { id: 'product', name: 'Café', sku: 'CAFE-1' },
            location: {
              id: 'location',
              name: 'General',
              code: 'GENERAL',
              warehouse: { id: 'warehouse', name: 'Bodega' },
            },
            responsible: { id: 'user', email: 'admin@example.com' },
          },
        ],
        meta: {
          apiVersion: '1',
          scope: { branch: { id: 'branch', name: 'Sucursal' } },
          pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
        },
      }),
    );
    fill('movementProduct', ' café ');
    const type = fixture.nativeElement.querySelector('#movementHistoryType') as HTMLSelectElement;
    type.value = 'SALE';
    type.dispatchEvent(new Event('change', { bubbles: true }));
    (fixture.componentInstance as unknown as { filterMovements(): void }).filterMovements();
    fixture.detectChanges();

    expect(inventory.listMovements).toHaveBeenLastCalledWith({
      q: 'café',
      type: 'SALE',
      page: 1,
      pageSize: 10,
    });
    expect(fixture.nativeElement.textContent).toContain('Venta V-1');
    expect(fixture.nativeElement.textContent).toContain('admin@example.com');
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
    expect(
      fixture.nativeElement.querySelector('[aria-label="Existencias por producto"]').textContent,
    ).toContain('CAFE-1');
  });

  it('requires evidence and sends a positive magnitude for an operational loss', () => {
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
      version: 1,
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
    inventory.createMovement.mockReturnValue(
      of({
        data: {
          id: 'loss-movement',
          product: { id: 'product', name: 'Café', sku: 'CAFE-1' },
          location: { id: 'location', name: 'General', code: 'GENERAL' },
          type: 'LOSS',
          quantityChange: '-1.000',
          quantity: '9.000',
          reason: 'Merma documentada',
          reference: 'INC-001',
          createdAt: new Date().toISOString(),
        },
        meta: { apiVersion: '1', idempotentReplay: false },
      }),
    );
    (fixture.componentInstance as unknown as { search(): void }).search();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.product-list button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const type = fixture.nativeElement.querySelector('#movementType') as HTMLSelectElement;
    type.value = 'LOSS';
    type.dispatchEvent(new Event('change', { bubbles: true }));
    fill('stockQuantity', '1');
    fill('stockReason', 'Merma documentada');
    (fixture.nativeElement.querySelector('.stock-card form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    fixture.detectChanges();

    expect(inventory.createMovement).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'La referencia es obligatoria para este tipo.',
    );

    fill('stockReference', 'INC-001');
    (fixture.nativeElement.querySelector('.stock-card form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    fixture.detectChanges();
    expect(inventory.createMovement).toHaveBeenCalledWith(
      {
        productId: 'product',
        locationId: 'location',
        type: 'LOSS',
        quantity: '1',
        reason: 'Merma documentada',
        reference: 'INC-001',
      },
      expect.stringMatching(/^web-/),
    );
    expect(fixture.nativeElement.textContent).toContain('Existencia 9.000');
  });

  it('shows reconciled stock states and reserves available inventory', () => {
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
      version: 1,
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
    inventory.getBalance.mockReturnValue(
      of({
        data: {
          product: { id: 'product', name: 'Café', sku: 'CAFE-1' },
          location: { id: 'location', name: 'General', code: 'GENERAL' },
          quantity: '10.000',
          totalQuantity: '10.000',
          availableQuantity: '7.000',
          states: [
            { code: 'AVAILABLE', quantity: '7.000' },
            { code: 'RESERVED', quantity: '2.000' },
            { code: 'DAMAGED', quantity: '1.000' },
            { code: 'IN_TRANSIT', quantity: '0.000' },
          ],
        },
        meta: { apiVersion: '1' },
      }),
    );
    inventory.createStateTransition.mockReturnValue(
      of({
        data: {
          id: 'state-transition',
          product: { id: 'product', name: 'Café', sku: 'CAFE-1' },
          location: { id: 'location', name: 'General', code: 'GENERAL' },
          type: 'STATE_TRANSITION',
          quantityChange: '0.000',
          quantity: '10.000',
          reason: 'Pedido confirmado',
          reference: 'PED-42',
          createdAt: new Date().toISOString(),
          stateTransition: { from: 'AVAILABLE', to: 'RESERVED', quantity: '2.000' },
        },
        meta: { apiVersion: '1', idempotentReplay: false },
      }),
    );

    (fixture.componentInstance as unknown as { search(): void }).search();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.product-list button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Reservado: 2.000');

    fill('stateQuantity', '2');
    fill('stateReason', 'Pedido confirmado');
    fill('stateReference', 'PED-42');
    (
      fixture.nativeElement.querySelector('.state-transition-form') as HTMLFormElement
    ).dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(inventory.createStateTransition).toHaveBeenCalledWith(
      {
        productId: 'product',
        locationId: 'location',
        fromState: 'AVAILABLE',
        toState: 'RESERVED',
        quantity: '2',
        reason: 'Pedido confirmado',
        reference: 'PED-42',
      },
      expect.stringMatching(/^web-state-/),
    );
    expect(fixture.nativeElement.textContent).toContain('Disponible → Reservado: 2.');

    const source = fixture.nativeElement.querySelector('#stateFrom') as HTMLSelectElement;
    source.value = 'DAMAGED';
    source.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
    const targets = Array.from(
      (fixture.nativeElement.querySelector('#stateTo') as HTMLSelectElement).options,
    ).map(({ value }) => value);
    expect(targets).toEqual(['AVAILABLE']);
  });

  it('creates and dispatches a transfer to a different active warehouse', () => {
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
      version: 1,
    };
    const destinationBranch = {
      id: 'branch-north',
      name: 'Sucursal Norte',
      timezone: 'America/Mexico_City',
      active: true,
      warehouses: [
        {
          id: 'warehouse-north',
          name: 'Bodega Norte',
          active: true,
          locations: [{ id: 'location-north', name: 'Recepción', code: 'NORTE', active: true }],
        },
      ],
    };
    organization.list.mockReturnValue(
      of({
        data: [
          {
            id: 'branch',
            name: 'Sucursal',
            timezone: 'America/Mexico_City',
            active: true,
            warehouses: [
              {
                id: 'warehouse',
                name: 'Bodega',
                active: true,
                locations: [{ id: 'location', name: 'General', code: 'GENERAL', active: true }],
              },
            ],
          },
          destinationBranch,
        ],
        meta: { apiVersion: '1' },
      }),
    );
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
    const draft = {
      id: 'transfer',
      status: 'DRAFT' as const,
      reference: 'TR-001',
      reason: 'Reabasto',
      originWarehouse: {
        id: 'warehouse',
        name: 'Bodega',
        branch: { id: 'branch', name: 'Sucursal' },
      },
      destinationWarehouse: {
        id: 'warehouse-north',
        name: 'Bodega Norte',
        branch: { id: 'branch-north', name: 'Sucursal Norte' },
      },
      lines: [
        {
          id: 'line',
          lineNumber: 1,
          product: { id: 'product', name: 'Café', sku: 'CAFE-1' },
          sourceLocation: { id: 'location', name: 'General', code: 'GENERAL' },
          destinationLocation: {
            id: 'location-north',
            name: 'Recepción',
            code: 'NORTE',
          },
          quantity: '3.000',
        },
      ],
      createdBy: { id: 'user', email: 'admin@example.com' },
      dispatchedBy: null,
      cancelledBy: null,
      createdAt: new Date().toISOString(),
      dispatchedAt: null,
      cancelledAt: null,
    };
    transfers.create.mockReturnValue(
      of({ data: draft, meta: { apiVersion: '1', idempotentReplay: false } }),
    );
    transfers.list.mockReturnValue(of({ data: [draft], meta: { apiVersion: '1' } }));
    transfers.dispatch.mockReturnValue(
      of({
        data: {
          ...draft,
          status: 'DISPATCHED',
          dispatchedBy: { id: 'user', email: 'admin@example.com' },
          dispatchedAt: new Date().toISOString(),
        },
        meta: { apiVersion: '1', idempotentReplay: false },
      }),
    );

    (fixture.componentInstance as unknown as { loadOrganization(): void }).loadOrganization();
    (fixture.componentInstance as unknown as { search(): void }).search();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.product-list button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const destinationOptions = Array.from(
      fixture.nativeElement.querySelectorAll('#transferDestinationWarehouse option'),
    ).map((option) => (option as HTMLOptionElement).value);
    expect(destinationOptions).toEqual(['warehouse-north']);
    fill('transferQuantity', '3');
    fill('transferReference', 'TR-001');
    fill('transferReason', 'Reabasto');
    (
      (fixture.nativeElement.querySelector('#transferQuantity') as HTMLInputElement).closest(
        'form',
      ) as HTMLFormElement
    ).dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(transfers.create).toHaveBeenCalledWith(
      {
        destinationWarehouseId: 'warehouse-north',
        reference: 'TR-001',
        reason: 'Reabasto',
        lines: [
          {
            productId: 'product',
            sourceLocationId: 'location',
            destinationLocationId: 'location-north',
            quantity: '3',
          },
        ],
      },
      expect.stringMatching(/^web-transfer-/),
    );
    const dispatchButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (button) => (button as HTMLButtonElement).textContent?.trim() === 'Despachar',
    ) as HTMLButtonElement | undefined;
    expect(dispatchButton).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Cancelar');
    dispatchButton!.click();
    fixture.detectChanges();
    expect(transfers.dispatch).toHaveBeenCalledWith(
      'transfer',
      expect.stringMatching(/^web-transfer-dispatch-/),
    );
    expect(fixture.nativeElement.textContent).toContain('Transferencia TR-001 despachada.');
  });

  it('shows an error when the stock overview cannot be loaded', () => {
    inventory.listStock.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    (fixture.componentInstance as unknown as { searchStock(): void }).searchStock();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No fue posible cargar las existencias.');
  });

  it('distinguishes insufficient permissions from an operational failure', () => {
    inventory.listStock.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    (fixture.componentInstance as unknown as { searchStock(): void }).searchStock();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('.stock-overview [role="alert"]');
    expect(alert.textContent).toContain(
      'No tienes permisos suficientes para realizar esta operación.',
    );
  });

  it('does not load or expose modules absent from the session permissions', () => {
    products.getOptions.mockClear();
    products.list.mockClear();
    inventory.listLocations.mockClear();
    inventory.listStock.mockClear();
    inventory.listMovements.mockClear();
    pos.listSales.mockClear();
    audit.list.mockClear();
    sessionState.set({
      user: { id: 'staff', email: 'staff@example.com', roles: ['STAFF'], permissions: [] },
      tenant: { id: 'tenant', name: 'Tienda' },
      context: {
        branch: { id: 'branch', name: 'Sucursal' },
        warehouse: { id: 'warehouse', name: 'Bodega' },
        cashRegister: { id: 'register', name: 'Caja', code: 'MAIN' },
      },
      nextStep: 'APPLICATION',
    });
    fixture.destroy();
    fixture = TestBed.createComponent(ApplicationPage);
    fixture.detectChanges();

    expect(products.getOptions).not.toHaveBeenCalled();
    expect(products.list).not.toHaveBeenCalled();
    expect(inventory.listLocations).not.toHaveBeenCalled();
    expect(inventory.listStock).not.toHaveBeenCalled();
    expect(inventory.listMovements).not.toHaveBeenCalled();
    expect(pos.listSales).not.toHaveBeenCalled();
    expect(audit.list).not.toHaveBeenCalled();

    const navigation = fixture.nativeElement.querySelector('nav') as HTMLElement;
    expect(navigation.textContent).not.toContain('Empresa');
    expect(navigation.textContent).not.toContain('Productos');
    expect(navigation.textContent).not.toContain('Inventario');
    expect(navigation.textContent).not.toContain('Punto de venta');
    expect(navigation.textContent).not.toContain('Auditoría');
    expect(fixture.nativeElement.textContent).toContain('Sin módulos asignados');
    expect(
      (fixture.nativeElement.querySelector('[aria-labelledby="products-title"]') as HTMLElement)
        .hidden,
    ).toBe(true);
    expect((fixture.nativeElement.querySelector('.pos-workspace') as HTMLElement).hidden).toBe(
      true,
    );
    expect((fixture.nativeElement.querySelector('.audit-log') as HTMLElement).hidden).toBe(true);
  });

  it('quotes a cart and prevents duplicate cash sale submission', () => {
    const product = {
      id: 'product',
      name: 'Café',
      sku: 'CAFE-1',
      barcode: '7501',
      category: null,
      brand: null,
      cost: '1.20',
      price: '119.90',
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
    pos.quote.mockImplementation((lines: Array<{ quantity: string }>) => {
      const doubled = lines[0].quantity === '2';
      return of({
        data: {
          context: {
            branch: { id: 'branch', name: 'Sucursal' },
            warehouse: { id: 'warehouse', name: 'Bodega' },
            cashRegister: { id: 'register', name: 'Caja', code: 'MAIN' },
          },
          currency: 'MXN',
          taxRate: '0.1600',
          lines: [
            {
              product: { id: 'product', name: 'Café', sku: 'CAFE-1' },
              quantity: doubled ? '2.000' : '1.000',
              availableQuantity: '5.000',
              unitPrice: '119.90',
              subtotal: doubled ? '206.72' : '103.36',
              tax: doubled ? '33.08' : '16.54',
              total: doubled ? '239.80' : '119.90',
            },
          ],
          totals: {
            subtotal: doubled ? '206.72' : '103.36',
            tax: doubled ? '33.08' : '16.54',
            total: doubled ? '239.80' : '119.90',
          },
        },
        meta: { apiVersion: '1', recalculatedAt: new Date().toISOString() },
      });
    });
    fill('posSearch', 'cafe-1');
    (fixture.componentInstance as unknown as { searchPos(): void }).searchPos();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.pos-results button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(pos.quote).toHaveBeenLastCalledWith([{ productId: 'product', quantity: '1' }]);
    expect(fixture.nativeElement.querySelector('.cart-panel').textContent).toContain('MXN 119.90');

    const quantity = fixture.nativeElement.querySelector(
      '[aria-label="Cantidad de Café"]',
    ) as HTMLInputElement;
    quantity.value = '2';
    quantity.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
    expect(pos.quote).toHaveBeenLastCalledWith([{ productId: 'product', quantity: '2' }]);
    expect(fixture.nativeElement.querySelector('.cart-panel').textContent).toContain('MXN 239.80');

    const saleResponse = new Subject<{
      data: CashSaleData;
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>();
    pos.createCashSale.mockReturnValue(saleResponse);
    fill('cashReceived', '250.00');
    (fixture.componentInstance as unknown as { completeCashSale(): void }).completeCashSale();
    (fixture.componentInstance as unknown as { completeCashSale(): void }).completeCashSale();

    expect(pos.createCashSale).toHaveBeenCalledTimes(1);
    expect(pos.createCashSale).toHaveBeenCalledWith(
      {
        lines: [{ productId: 'product', quantity: '2' }],
        cashReceived: '250.00',
      },
      expect.stringMatching(/^web-sale-/),
    );
    saleResponse.next({
      data: {
        id: 'sale',
        receiptNumber: 'V-123456789012',
        status: 'COMPLETED',
        context: {
          branch: { id: 'branch', name: 'Sucursal' },
          warehouse: { id: 'warehouse', name: 'Bodega' },
          cashRegister: { id: 'register', name: 'Caja', code: 'MAIN' },
        },
        userId: 'user',
        currency: 'MXN',
        taxRate: '0.1600',
        lines: [
          {
            product: { id: 'product', name: 'Café', sku: 'CAFE-1' },
            quantity: '2.000',
            unitPrice: '119.90',
            subtotal: '206.72',
            tax: '33.08',
            total: '239.80',
          },
        ],
        totals: { subtotal: '206.72', tax: '33.08', total: '239.80' },
        payment: {
          method: 'CASH',
          amountReceived: '250.00',
          amountApplied: '239.80',
          change: '10.20',
        },
        createdAt: new Date().toISOString(),
      },
      meta: { apiVersion: '1', idempotentReplay: false },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Venta V-123456789012 completada');
    expect(fixture.nativeElement.textContent).toContain('Cambio MXN 10.20');
    expect(inventory.listStock).toHaveBeenCalledTimes(2);
    expect(pos.listSales).toHaveBeenCalledTimes(2);
  });
});
