import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { ProductApiService } from '../catalog/product-api.service';
import { InventoryApiService } from '../inventory/inventory-api.service';
import { CashRegisterClosureData, CashSaleData, PosApiService } from '../pos/pos-api.service';
import { ApplicationPage } from './application.page';
import { SessionApiService, SessionData } from './session-api.service';
import { AuditApiService } from '../audit/audit-api.service';
import { OrganizationApiService } from '../organization/organization-api.service';
import { InventoryTransferApiService } from '../inventory/inventory-transfer-api.service';
import { AccessApiService } from '../access/access-api.service';

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
    getCurrentShift: ReturnType<typeof vi.fn>;
    openShift: ReturnType<typeof vi.fn>;
    listCashMovements: ReturnType<typeof vi.fn>;
    createCashMovement: ReturnType<typeof vi.fn>;
    reverseCashMovement: ReturnType<typeof vi.fn>;
    getLatestClosure: ReturnType<typeof vi.fn>;
    closeShift: ReturnType<typeof vi.fn>;
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
    receive: ReturnType<typeof vi.fn>;
  };
  let access: {
    listRoles: ReturnType<typeof vi.fn>;
    createRole: ReturnType<typeof vi.fn>;
    listUsers: ReturnType<typeof vi.fn>;
    createUser: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
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
            policy: { negativeStock: 'DENY' },
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
      getCurrentShift: vi.fn().mockReturnValue(
        of({
          data: {
            id: 'shift',
            status: 'OPEN',
            branch: { id: 'branch', name: 'Sucursal' },
            cashRegister: { id: 'register', name: 'Caja', code: 'MAIN' },
            openedBy: { id: 'user', email: 'admin@example.com' },
            openingAmount: '100.00',
            currency: 'MXN',
            openedAt: '2026-08-27T14:00:00.000Z',
          },
          meta: { apiVersion: '1' },
        }),
      ),
      openShift: vi.fn(),
      listCashMovements: vi.fn().mockReturnValue(
        of({
          data: [],
          meta: {
            apiVersion: '1',
            shiftId: 'shift',
            currency: 'MXN',
            expectedCash: '100.00',
          },
        }),
      ),
      createCashMovement: vi.fn(),
      reverseCashMovement: vi.fn(),
      getLatestClosure: vi.fn().mockReturnValue(of({ data: null, meta: { apiVersion: '1' } })),
      closeShift: vi.fn(),
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
      receive: vi.fn(),
    };
    access = {
      listRoles: vi.fn().mockReturnValue(of({ data: [], meta: { apiVersion: '1' } })),
      createRole: vi.fn(),
      listUsers: vi.fn().mockReturnValue(of({ data: [], meta: { apiVersion: '1' } })),
      createUser: vi.fn(),
      updateUser: vi.fn(),
    };
    sessionState = signal<SessionData | null>({
      user: {
        id: 'user',
        email: 'admin@example.com',
        roles: ['ADMIN'],
        permissions: [
          'TENANT_MANAGE',
          'PRODUCTS_MANAGE',
          'SALES_MANAGE',
          'ACCESS_MANAGE',
          'INVENTORY_VIEW',
          'INVENTORY_ADJUST',
          'INVENTORY_TRANSFER',
          'INVENTORY_COUNT',
          'INVENTORY_APPROVE',
        ],
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
        { provide: AccessApiService, useValue: access },
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
            previousQuantity: '10.000',
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
            correlationId: 'sale',
            idempotencyKey: 'sale-complete-key',
            document: { type: 'SALE', id: 'sale', reference: 'V-1' },
            stateTransition: null,
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
    fill('movementLocation', ' general ');
    fill('movementResponsible', ' admin@example.com ');
    fill('movementDocument', ' V-1 ');
    const type = fixture.nativeElement.querySelector('#movementHistoryType') as HTMLSelectElement;
    type.value = 'SALE';
    type.dispatchEvent(new Event('change', { bubbles: true }));
    (fixture.componentInstance as unknown as { filterMovements(): void }).filterMovements();
    fixture.detectChanges();

    expect(inventory.listMovements).toHaveBeenLastCalledWith({
      q: 'café',
      location: 'general',
      responsible: 'admin@example.com',
      document: 'V-1',
      type: 'SALE',
      page: 1,
      pageSize: 10,
    });
    expect(fixture.nativeElement.textContent).toContain('Venta V-1');
    expect(fixture.nativeElement.textContent).toContain('admin@example.com');
    expect(fixture.nativeElement.textContent).toContain('10.000 → 9.000');
    expect(fixture.nativeElement.textContent).toContain('sale-complete-key');
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
          policy: { negativeStock: 'DENY' },
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
    expect(fixture.nativeElement.textContent).toContain('stock negativo bloqueado');
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
          receivedQuantity: '0.000',
          discrepancyQuantity: '0.000',
          pendingQuantity: '3.000',
        },
      ],
      receipts: [],
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
    const dispatched = {
      ...draft,
      status: 'DISPATCHED' as const,
      dispatchedBy: { id: 'user', email: 'admin@example.com' },
      dispatchedAt: new Date().toISOString(),
    };
    transfers.dispatch.mockReturnValue(
      of({
        data: dispatched,
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
    transfers.list.mockReturnValue(of({ data: [dispatched], meta: { apiVersion: '1' } }));
    dispatchButton!.click();
    fixture.detectChanges();
    expect(transfers.dispatch).toHaveBeenCalledWith(
      'transfer',
      expect.stringMatching(/^web-transfer-dispatch-/),
    );
    expect(fixture.nativeElement.textContent).toContain('Transferencia TR-001 despachada.');

    const received = {
      ...dispatched,
      status: 'RECEIVED' as const,
      lines: [
        {
          ...dispatched.lines[0],
          receivedQuantity: '3.000',
          pendingQuantity: '0.000',
        },
      ],
      receipts: [
        {
          id: 'receipt',
          discrepancyReason: null,
          receivedBy: { id: 'user', email: 'admin@example.com' },
          createdAt: new Date().toISOString(),
          lines: [
            {
              id: 'receipt-line',
              lineNumber: 1,
              transferLineId: 'line',
              product: { id: 'product', name: 'Café', sku: 'CAFE-1' },
              receivedQuantity: '3.000',
              discrepancyQuantity: '0.000',
            },
          ],
        },
      ],
    };
    transfers.receive.mockReturnValue(
      of({ data: received, meta: { apiVersion: '1', idempotentReplay: false } }),
    );
    transfers.list.mockReturnValue(of({ data: [received], meta: { apiVersion: '1' } }));
    sessionState.set({
      ...sessionState()!,
      context: {
        ...sessionState()!.context,
        branch: { id: 'branch-north', name: 'Sucursal Norte' },
        warehouse: { id: 'warehouse-north', name: 'Bodega Norte' },
      },
    });
    fixture.detectChanges();
    const receivedInput = fixture.nativeElement.querySelector(
      '[aria-label="Cantidad recibida"]',
    ) as HTMLInputElement;
    expect(receivedInput.value).toBe('3.000');
    (
      fixture.componentInstance as unknown as {
        receiveTransferLine(
          transfer: typeof dispatched,
          line: (typeof dispatched.lines)[number],
          receivedValue: string,
          discrepancyValue: string,
          reasonValue: string,
        ): void;
      }
    ).receiveTransferLine(dispatched, dispatched.lines[0], receivedInput.value, '0', '');
    fixture.detectChanges();
    expect(transfers.receive).toHaveBeenCalledWith(
      'transfer',
      {
        lines: [
          {
            transferLineId: 'line',
            receivedQuantity: '3.000',
            discrepancyQuantity: '0',
          },
        ],
      },
      expect.stringMatching(/^web-transfer-receipt-/),
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Transferencia TR-001 recibida por completo.',
    );
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

  it('lets a viewer inspect inventory without exposing mutating controls', () => {
    products.getOptions.mockClear();
    products.list.mockClear();
    inventory.listStock.mockClear();
    access.listRoles.mockClear();
    sessionState.set({
      user: {
        id: 'viewer',
        email: 'viewer@example.com',
        roles: ['VIEWER'],
        permissions: ['INVENTORY_VIEW'],
      },
      tenant: { id: 'tenant', name: 'Tienda' },
      context: {
        branch: { id: 'branch', name: 'Sucursal' },
        warehouse: { id: 'warehouse', name: 'Bodega' },
        cashRegister: null,
      },
      nextStep: 'APPLICATION',
    });
    fixture.destroy();
    fixture = TestBed.createComponent(ApplicationPage);
    fixture.detectChanges();

    expect(products.getOptions).not.toHaveBeenCalled();
    expect(products.list).toHaveBeenCalled();
    expect(inventory.listStock).toHaveBeenCalled();
    expect(access.listRoles).not.toHaveBeenCalled();
    expect(
      (fixture.nativeElement.querySelector('.catalog-product-form') as HTMLElement).hidden,
    ).toBe(true);
    expect(
      (fixture.nativeElement.querySelector('#transferQuantity') as HTMLElement).closest('form')
        ?.hidden,
    ).toBe(true);
    expect(
      (fixture.nativeElement.querySelector('[aria-labelledby="access-title"]') as HTMLElement)
        .hidden,
    ).toBe(true);
  });

  it('creates a granular role and delegates it to one branch', () => {
    const role = {
      id: 'role-id',
      name: 'Operador',
      permissions: ['INVENTORY_VIEW', 'INVENTORY_ADJUST'] as const,
    };
    access.createRole.mockReturnValue(of({ data: role, meta: { apiVersion: '1' } }));
    access.listRoles.mockReturnValue(of({ data: [role], meta: { apiVersion: '1' } }));
    access.createUser.mockReturnValue(
      of({
        data: {
          id: 'staff-id',
          email: 'operator@example.com',
          roles: [role],
          branches: [{ id: 'branch', name: 'Sucursal' }],
          manageable: true,
        },
        meta: { apiVersion: '1' },
      }),
    );

    fill('accessRoleName', 'Operador');
    const permissionInputs = Array.from(
      fixture.nativeElement.querySelectorAll(
        '[aria-labelledby="access-title"] input[type="checkbox"]',
      ) as NodeListOf<HTMLInputElement>,
    );
    permissionInputs[1].click();
    (fixture.nativeElement.querySelector('#accessRoleName') as HTMLElement)
      .closest('form')
      ?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(access.createRole).toHaveBeenCalledWith('Operador', [
      'INVENTORY_VIEW',
      'INVENTORY_ADJUST',
    ]);

    fill('accessUserEmail', 'operator@example.com');
    fill('accessUserPassword', 'SecurePass1!');
    (fixture.nativeElement.querySelector('#accessUserEmail') as HTMLElement)
      .closest('form')
      ?.dispatchEvent(new Event('submit'));

    expect(access.createUser).toHaveBeenCalledWith(
      'operator@example.com',
      'SecurePass1!',
      ['role-id'],
      ['branch'],
    );
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

  it('requires and opens the active cash register before exposing POS operations', () => {
    fixture.destroy();
    pos.getCurrentShift.mockReturnValue(of({ data: null, meta: { apiVersion: '1' } }));
    fixture = TestBed.createComponent(ApplicationPage);
    fixture.detectChanges();

    expect((fixture.nativeElement.querySelector('.pos-grid') as HTMLElement).hidden).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Abrir caja');

    const response = new Subject<{
      data: {
        id: string;
        status: 'OPEN';
        branch: { id: string; name: string };
        cashRegister: { id: string; name: string; code: string };
        openedBy: { id: string; email: string };
        openingAmount: string;
        currency: string;
        openedAt: string;
      };
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>();
    pos.openShift.mockReturnValue(response);
    fill('openingAmount', '250.00');
    (fixture.nativeElement.querySelector('.cash-shift-opening') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    (
      fixture.componentInstance as unknown as { openCashRegisterShift(): void }
    ).openCashRegisterShift();

    expect(pos.openShift).toHaveBeenCalledTimes(1);
    expect(pos.openShift).toHaveBeenCalledWith('250.00', expect.stringMatching(/^web-shift-/));
    response.next({
      data: {
        id: 'shift-new',
        status: 'OPEN',
        branch: { id: 'branch', name: 'Sucursal' },
        cashRegister: { id: 'register', name: 'Caja', code: 'MAIN' },
        openedBy: { id: 'user', email: 'admin@example.com' },
        openingAmount: '250.00',
        currency: 'MXN',
        openedAt: '2026-08-27T14:00:00.000Z',
      },
      meta: { apiVersion: '1', idempotentReplay: false },
    });
    fixture.detectChanges();

    expect((fixture.nativeElement.querySelector('.pos-grid') as HTMLElement).hidden).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Caja abierta y lista para vender.');
    expect(fixture.nativeElement.textContent).toContain('MXN 250.00');
  });

  it('records an immutable cash movement and reverses it explicitly', () => {
    const movement = {
      id: 'cash-movement',
      type: 'INCOME' as const,
      amount: '50.00',
      reason: 'Fondo adicional',
      responsible: { id: 'user', email: 'admin@example.com' },
      reversalOf: null,
      reversed: false,
      createdAt: '2026-08-27T14:10:00.000Z',
    };
    const createResponse = new Subject<{
      data: typeof movement;
      meta: { apiVersion: '1'; expectedCash: string; idempotentReplay: boolean };
    }>();
    pos.createCashMovement.mockReturnValue(createResponse);
    fill('cashMovementAmount', '50.00');
    fill('cashMovementReason', 'Fondo adicional');
    (
      fixture.nativeElement.querySelector('.cash-movements .cash-payment') as HTMLFormElement
    ).dispatchEvent(new Event('submit'));
    (fixture.componentInstance as unknown as { submitCashMovement(): void }).submitCashMovement();

    expect(pos.createCashMovement).toHaveBeenCalledTimes(1);
    expect(pos.createCashMovement).toHaveBeenCalledWith(
      { type: 'INCOME', amount: '50.00', reason: 'Fondo adicional' },
      expect.stringMatching(/^web-cash-movement-/),
    );
    pos.listCashMovements.mockReturnValue(
      of({
        data: [movement],
        meta: {
          apiVersion: '1',
          shiftId: 'shift',
          currency: 'MXN',
          expectedCash: '150.00',
        },
      }),
    );
    createResponse.next({
      data: movement,
      meta: { apiVersion: '1', expectedCash: '150.00', idempotentReplay: false },
    });
    createResponse.complete();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Saldo esperado MXN 150.00');
    expect(fixture.nativeElement.textContent).toContain('Ingreso confirmado.');
    (
      fixture.nativeElement.querySelector(
        '.cash-movements .pos-results button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const reverseResponse = new Subject<{
      data: {
        id: string;
        type: 'REVERSAL';
        amount: string;
        reason: string;
        responsible: { id: string; email: string };
        reversalOf: { id: string; type: 'INCOME'; reason: string };
        reversed: boolean;
        createdAt: string;
      };
      meta: { apiVersion: '1'; expectedCash: string; idempotentReplay: boolean };
    }>();
    pos.reverseCashMovement.mockReturnValue(reverseResponse);
    fill('cashMovementReversalReason', 'Captura incorrecta');
    (fixture.componentInstance as unknown as { reverseCashMovement(): void }).reverseCashMovement();
    (fixture.componentInstance as unknown as { reverseCashMovement(): void }).reverseCashMovement();

    expect(pos.reverseCashMovement).toHaveBeenCalledTimes(1);
    expect(pos.reverseCashMovement).toHaveBeenCalledWith(
      'cash-movement',
      'Captura incorrecta',
      expect.stringMatching(/^web-cash-reversal-/),
    );
    pos.listCashMovements.mockReturnValue(
      of({
        data: [{ ...movement, reversed: true }],
        meta: {
          apiVersion: '1',
          shiftId: 'shift',
          currency: 'MXN',
          expectedCash: '100.00',
        },
      }),
    );
    reverseResponse.next({
      data: {
        id: 'cash-reversal',
        type: 'REVERSAL',
        amount: '50.00',
        reason: 'Captura incorrecta',
        responsible: { id: 'user', email: 'admin@example.com' },
        reversalOf: { id: movement.id, type: 'INCOME', reason: movement.reason },
        reversed: false,
        createdAt: '2026-08-27T14:15:00.000Z',
      },
      meta: { apiVersion: '1', expectedCash: '100.00', idempotentReplay: false },
    });
    reverseResponse.complete();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Saldo esperado MXN 100.00');
    expect(fixture.nativeElement.textContent).toContain('Reversa confirmada');
    expect(fixture.nativeElement.textContent).toContain('Reversado');
  });

  it('closes the active cash register and renders the persisted reconciliation', () => {
    const response = new Subject<{
      data: CashRegisterClosureData;
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>();
    pos.closeShift.mockReturnValue(response);
    fill('cashCountedAmount', '100.00');
    fill('cashDenominations', '50x2');
    (fixture.nativeElement.querySelector('.cash-closure-form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    (
      fixture.componentInstance as unknown as { closeCashRegisterShift(): void }
    ).closeCashRegisterShift();

    expect(pos.closeShift).toHaveBeenCalledTimes(1);
    expect(pos.closeShift).toHaveBeenCalledWith(
      {
        countedAmount: '100.00',
        denominations: [{ denomination: '50', quantity: 2 }],
      },
      expect.stringMatching(/^web-cash-closure-/),
    );
    response.next({
      data: {
        id: 'closure',
        status: 'CLOSED',
        branch: { id: 'branch', name: 'Sucursal' },
        cashRegister: { id: 'register', name: 'Caja', code: 'MAIN' },
        openedBy: { id: 'user', email: 'admin@example.com' },
        closedBy: { id: 'user', email: 'admin@example.com' },
        currency: 'MXN',
        openingAmount: '100.00',
        salesCount: 0,
        cashSales: '0.00',
        movementsCount: 0,
        movementsNet: '0.00',
        expectedCash: '100.00',
        countedCash: '100.00',
        difference: '0.00',
        differenceReason: null,
        denominations: [{ denomination: '50.00', quantity: 2 }],
        openedAt: '2026-08-27T14:00:00.000Z',
        closedAt: '2026-08-27T15:00:00.000Z',
      },
      meta: { apiVersion: '1', idempotentReplay: false },
    });
    response.complete();
    fixture.detectChanges();

    expect((fixture.nativeElement.querySelector('.pos-grid') as HTMLElement).hidden).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Caja cerrada');
    expect(fixture.nativeElement.textContent).toContain('Último arqueo');
    expect(fixture.nativeElement.textContent).toContain('Diferencia MXN 0.00');
    expect(fixture.nativeElement.textContent).toContain('Abrir caja');
  });
});
