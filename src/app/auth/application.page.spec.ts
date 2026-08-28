import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { ProductApiService } from '../catalog/product-api.service';
import { InventoryApiService } from '../inventory/inventory-api.service';
import {
  CashRegisterClosureData,
  CashSaleData,
  PosApiService,
  SaleDetailData,
} from '../pos/pos-api.service';
import { ApplicationPage } from './application.page';
import { SessionApiService, SessionData } from './session-api.service';
import { AuditApiService } from '../audit/audit-api.service';
import { OrganizationApiService } from '../organization/organization-api.service';
import { InventoryTransferApiService } from '../inventory/inventory-transfer-api.service';
import { AccessApiService } from '../access/access-api.service';
import { CustomerApiService } from '../customers/customer-api.service';
import { ProductReservationApiService } from '../reservations/product-reservation-api.service';
import { OfflinePosService } from '../offline/offline-pos.service';

describe('ApplicationPage', () => {
  let fixture: ComponentFixture<ApplicationPage>;
  let products: {
    getOptions: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    retire: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    resolveCode: ReturnType<typeof vi.fn>;
    listClassifications: ReturnType<typeof vi.fn>;
    createClassification: ReturnType<typeof vi.fn>;
    updateClassification: ReturnType<typeof vi.fn>;
    deactivateClassification: ReturnType<typeof vi.fn>;
  };
  let inventory: {
    listLocations: ReturnType<typeof vi.fn>;
    listStock: ReturnType<typeof vi.fn>;
    listStockAlerts: ReturnType<typeof vi.fn>;
    setStockAlertThreshold: ReturnType<typeof vi.fn>;
    listLots: ReturnType<typeof vi.fn>;
    listFifoLayers: ReturnType<typeof vi.fn>;
    listMovements: ReturnType<typeof vi.fn>;
    getBalance: ReturnType<typeof vi.fn>;
    createMovement: ReturnType<typeof vi.fn>;
    createStateTransition: ReturnType<typeof vi.fn>;
    previewImport: ReturnType<typeof vi.fn>;
    confirmImport: ReturnType<typeof vi.fn>;
    listCountSessions: ReturnType<typeof vi.fn>;
    getCountSession: ReturnType<typeof vi.fn>;
    createCountSession: ReturnType<typeof vi.fn>;
    recordCount: ReturnType<typeof vi.fn>;
    closeCountSession: ReturnType<typeof vi.fn>;
    getValuationPolicy: ReturnType<typeof vi.fn>;
    previewValuationPolicy: ReturnType<typeof vi.fn>;
    changeValuationPolicy: ReturnType<typeof vi.fn>;
    latestReconciliation: ReturnType<typeof vi.fn>;
    runReconciliation: ReturnType<typeof vi.fn>;
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
    getPaymentOptions: ReturnType<typeof vi.fn>;
    createSale: ReturnType<typeof vi.fn>;
    createCashSale: ReturnType<typeof vi.fn>;
    voidSale: ReturnType<typeof vi.fn>;
    listSales: ReturnType<typeof vi.fn>;
    getSale: ReturnType<typeof vi.fn>;
    reprintSaleReceipt: ReturnType<typeof vi.fn>;
    sendSaleReceipt: ReturnType<typeof vi.fn>;
    getPeripheralProfile: ReturnType<typeof vi.fn>;
    updatePeripheralProfile: ReturnType<typeof vi.fn>;
    printSaleReceipt: ReturnType<typeof vi.fn>;
    openCashDrawer: ReturnType<typeof vi.fn>;
    listSaleReturns: ReturnType<typeof vi.fn>;
    createSaleReturn: ReturnType<typeof vi.fn>;
    listSuspendedSales: ReturnType<typeof vi.fn>;
    suspendSale: ReturnType<typeof vi.fn>;
    resumeSuspendedSale: ReturnType<typeof vi.fn>;
    cancelSuspendedSale: ReturnType<typeof vi.fn>;
    salesCashReport: ReturnType<typeof vi.fn>;
  };
  let audit: {
    list: ReturnType<typeof vi.fn>;
    export: ReturnType<typeof vi.fn>;
  };
  let organization: {
    list: ReturnType<typeof vi.fn>;
    createBranch: ReturnType<typeof vi.fn>;
    updateBranch: ReturnType<typeof vi.fn>;
    retireBranch: ReturnType<typeof vi.fn>;
    createWarehouse: ReturnType<typeof vi.fn>;
    createCashRegister: ReturnType<typeof vi.fn>;
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
  let customers: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    deactivate: ReturnType<typeof vi.fn>;
    history: ReturnType<typeof vi.fn>;
  };
  let productReservations: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let offlinePos: {
    search: ReturnType<typeof vi.fn>;
    quote: ReturnType<typeof vi.fn>;
    queueCashSale: ReturnType<typeof vi.fn>;
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
      resolveCode: vi.fn(),
      listClassifications: vi.fn().mockReturnValue(of({ data: [] })),
      createClassification: vi.fn(),
      updateClassification: vi.fn(),
      deactivateClassification: vi.fn(),
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
            valuation: {
              method: 'MOVING_AVERAGE',
              policyVersion: 1,
              effectiveAt: '2026-01-01T00:00:00.000Z',
              currency: 'MXN',
              asOf: '2026-01-01T01:00:00.000Z',
            },
            pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
          },
        }),
      ),
      listStockAlerts: vi.fn().mockReturnValue(
        of({
          data: [],
          meta: {
            apiVersion: '1',
            defaultThreshold: '5.000',
            scope: {
              branch: { id: 'branch', name: 'Sucursal' },
              warehouse: { id: 'warehouse', name: 'Bodega' },
            },
            pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
          },
        }),
      ),
      setStockAlertThreshold: vi.fn(),
      listLots: vi.fn().mockReturnValue(
        of({
          data: [],
          meta: {
            apiVersion: '1',
            tracked: false,
            totalQuantity: '0.000',
            lotQuantity: '0.000',
            reconciled: true,
            currency: null,
            inventoryValue: '0.0000',
          },
        }),
      ),
      listFifoLayers: vi.fn().mockReturnValue(
        of({
          data: [],
          meta: {
            apiVersion: '1',
            method: 'FIFO',
            cutover: {
              effectiveAt: '2026-08-28T00:00:00.000Z',
              migrationRule: 'OPENING_BALANCE_AT_MOVING_AVERAGE',
            },
            totalQuantity: '0.000',
            layerQuantity: '0.000',
            reconciled: true,
            currency: null,
            inventoryValue: '0.0000',
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
      previewImport: vi.fn(),
      confirmImport: vi.fn(),
      listCountSessions: vi.fn().mockReturnValue(of({ data: [], meta: { apiVersion: '1' } })),
      getCountSession: vi.fn(),
      createCountSession: vi.fn(),
      recordCount: vi.fn(),
      closeCountSession: vi.fn(),
      getValuationPolicy: vi.fn().mockReturnValue(
        of({
          data: {
            method: 'MOVING_AVERAGE',
            version: 1,
            effectiveAt: '2026-08-28T00:00:00.000Z',
            migrationRule: 'INITIAL_DEFAULT',
          },
          meta: { apiVersion: '1' },
        }),
      ),
      previewValuationPolicy: vi.fn(),
      changeValuationPolicy: vi.fn(),
      latestReconciliation: vi.fn().mockReturnValue(of({ data: null, meta: { apiVersion: '1' } })),
      runReconciliation: vi.fn(),
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
      getPaymentOptions: vi.fn().mockReturnValue(
        of({
          data: {
            methods: ['CASH', 'CARD', 'TRANSFER', 'VOUCHER'],
            nonCashProvider: 'SIMULATOR',
          },
          meta: { apiVersion: '1' },
        }),
      ),
      createSale: vi.fn(),
      createCashSale: vi.fn(),
      voidSale: vi.fn(),
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
      reprintSaleReceipt: vi.fn(),
      sendSaleReceipt: vi.fn(),
      getPeripheralProfile: vi.fn(),
      updatePeripheralProfile: vi.fn(),
      printSaleReceipt: vi.fn(),
      openCashDrawer: vi.fn().mockReturnValue(
        of({
          data: {
            id: 'drawer-operation',
            action: 'OPEN_DRAWER',
            trigger: 'CASH_SALE_COMPLETED',
            status: 'COMPLETED',
            attemptCount: 1,
            errorCode: null,
            saleId: 'sale',
            deviceId: 'SIM-register',
            createdAt: '2026-08-28T12:00:00.000Z',
            completedAt: '2026-08-28T12:00:00.000Z',
          },
          meta: { apiVersion: '1', idempotentReplay: false },
        }),
      ),
      listSaleReturns: vi.fn().mockReturnValue(of({ data: [], meta: { apiVersion: '1' } })),
      createSaleReturn: vi.fn(),
      listSuspendedSales: vi
        .fn()
        .mockReturnValue(of({ data: [], meta: { apiVersion: '1', expirationHours: 24 } })),
      suspendSale: vi.fn(),
      resumeSuspendedSale: vi.fn(),
      cancelSuspendedSale: vi.fn(),
      salesCashReport: vi.fn().mockReturnValue(
        of({
          data: {
            scope: [{ id: 'branch', name: 'Sucursal', timezone: 'America/Mexico_City' }],
            options: {
              branches: [{ id: 'branch', name: 'Sucursal', timezone: 'America/Mexico_City' }],
              registers: [{ id: 'register', name: 'Caja', code: 'MAIN', branch_id: 'branch' }],
              users: [{ id: 'user', email: 'admin@example.com' }],
            },
            summary: {
              sales: { total: 0, completed: 0, voided: 0, net: '0.00', voidedAmount: '0.00' },
              payments: [],
              cash: {
                shifts: 1,
                open: 1,
                closed: 0,
                expected: '100.00',
                counted: '0.00',
                difference: '0.00',
              },
              reconciliation: { salesNet: '0.00', paymentsApplied: '0.00', matches: true },
            },
            sales: [],
            shifts: [],
            total: 0,
          },
          meta: {
            apiVersion: '1',
            pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
            periodTimezone: 'BRANCH_LOCAL',
          },
        }),
      ),
    };
    offlinePos = {
      search: vi.fn(),
      quote: vi.fn(),
      queueCashSale: vi.fn(),
    };
    audit = {
      list: vi.fn().mockReturnValue(
        of({
          data: [],
          meta: {
            apiVersion: '1',
            retention: { minimumDays: 365, policy: 'APPEND_ONLY' },
            integrity: { valid: true },
            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
          },
        }),
      ),
      export: vi.fn(),
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
              cashRegisters: [{ id: 'register', name: 'Caja', code: 'MAIN' }],
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
      createCashRegister: vi.fn(),
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
    customers = {
      list: vi.fn().mockReturnValue(
        of({
          data: [],
          meta: {
            apiVersion: '1',
            pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
          },
        }),
      ),
      create: vi.fn(),
      update: vi.fn(),
      deactivate: vi.fn(),
      history: vi.fn(),
    };
    productReservations = {
      list: vi.fn().mockReturnValue(of({ data: [], meta: { apiVersion: '1' } })),
      create: vi.fn(),
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
          'SALES_VOID',
          'SALES_RETURN',
          'SALES_DISCOUNT',
          'SALE_REPRINT',
          'CASH_DRAWER_OPEN',
          'CASH_REGISTER_OPEN',
          'CASH_REGISTER_CLOSE',
          'CASH_REGISTER_MOVE',
          'ACCESS_MANAGE',
          'AUDIT_VIEW',
          'AUDIT_EXPORT',
          'INVENTORY_VIEW',
          'INVENTORY_ADJUST',
          'INVENTORY_TRANSFER',
          'INVENTORY_COUNT',
          'INVENTORY_APPROVE',
          'INVENTORY_VALUATION_MANAGE',
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
        { provide: CustomerApiService, useValue: customers },
        { provide: ProductReservationApiService, useValue: productReservations },
        { provide: OfflinePosService, useValue: offlinePos },
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
      trackLots: false,
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

    expect(sessions.changeContext).toHaveBeenCalledWith(
      'branch-north',
      'warehouse-north',
      undefined,
    );
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

  it('creates an additional cash register for a selected branch', () => {
    organization.createCashRegister.mockReturnValue(
      of({
        data: { id: 'register-2', branchId: 'branch', name: 'Caja 2', code: 'POS-2' },
        meta: { apiVersion: '1' },
      }),
    );
    fill('cashRegisterName', 'Caja 2');
    fill('cashRegisterCode', 'pos-2');
    (
      (fixture.nativeElement.querySelector('#cashRegisterName') as HTMLInputElement).closest(
        'form',
      ) as HTMLFormElement
    ).dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(organization.createCashRegister).toHaveBeenCalledWith('branch', {
      name: 'Caja 2',
      code: 'POS-2',
    });
    expect(fixture.nativeElement.textContent).toContain('Caja creada y disponible para asignar.');
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
      trackLots: false,
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
            costing: {
              method: 'MOVING_AVERAGE',
              currency: 'MXN',
              quantity: '10.000',
              inventoryValue: '12.0000',
              reconciled: true,
            },
          },
        ],
        meta: {
          apiVersion: '1',
          policy: { negativeStock: 'DENY' },
          scope: {
            branch: { id: 'branch', name: 'Sucursal' },
            warehouse: { id: 'warehouse', name: 'Bodega' },
          },
          valuation: {
            method: 'MOVING_AVERAGE',
            policyVersion: 1,
            effectiveAt: '2026-01-01T00:00:00.000Z',
            currency: 'MXN',
            asOf: '2026-01-01T01:00:00.000Z',
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
    expect(fixture.nativeElement.textContent).toContain('Promedio móvil');
    expect(fixture.nativeElement.textContent).toContain('MXN');
    expect(fixture.nativeElement.textContent).toContain('Cantidad valorizada 10.000');
    expect(fixture.nativeElement.textContent).toContain('12.0000');
  });

  it('previews and confirms an atomic inventory import from the real file control', () => {
    const preview = {
      id: '11111111-1111-4111-8111-111111111111',
      mode: 'COUNT' as const,
      status: 'PREVIEWED' as const,
      sourceFilename: 'conteo.csv',
      policy: 'ATOMIC' as const,
      canConfirm: true,
      summary: { rows: 1, validRows: 1, errorRows: 0, movements: null },
      rows: [
        {
          id: 'row-1',
          rowNumber: 2,
          product: { id: 'product', name: 'Café', sku: 'CAFE-1' },
          location: { id: 'location', name: 'General', code: 'GENERAL' },
          state: 'AVAILABLE' as const,
          targetQuantity: '12.000',
          currentQuantity: '10.000',
          difference: '2.000',
          reason: 'Conteo físico',
          errors: [],
        },
      ],
      confirmedAt: null,
    };
    inventory.previewImport.mockReturnValue(of({ data: preview, meta: { apiVersion: '1' } }));
    inventory.confirmImport.mockReturnValue(
      of({
        data: {
          ...preview,
          status: 'CONFIRMED',
          canConfirm: false,
          summary: { ...preview.summary, movements: 1 },
          confirmedAt: '2026-08-27T12:00:00.000Z',
        },
        meta: { apiVersion: '1', idempotentReplay: false },
      }),
    );

    const mode = fixture.nativeElement.querySelector('#inventoryImportMode') as HTMLSelectElement;
    mode.value = 'COUNT';
    mode.dispatchEvent(new Event('change', { bubbles: true }));
    const file = new File(
      ['sku,location,quantity,state,reason\nCAFE-1,GENERAL,12,AVAILABLE,Conteo físico'],
      'conteo.csv',
      { type: 'text/csv' },
    );
    const fileInput = fixture.nativeElement.querySelector(
      '#inventoryImportFile',
    ) as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector(
        'section[aria-labelledby="inventory-import-title"] .import-controls button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(inventory.previewImport).toHaveBeenCalledWith(file, 'COUNT');
    expect(fixture.nativeElement.textContent).toContain('10.000 → 12.000');
    expect(fixture.nativeElement.textContent).toContain('Política atómica');

    const stockLoadsBeforeConfirmation = inventory.listStock.mock.calls.length;
    (fixture.nativeElement.querySelector('.confirm-import') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(inventory.confirmImport).toHaveBeenCalledWith(
      preview.id,
      expect.stringMatching(/^web-inventory-import-/),
    );
    expect(fixture.nativeElement.textContent).toContain('1 movimiento(s) aplicado(s)');
    expect(fixture.nativeElement.textContent).toContain('trazable en el historial');
    expect(inventory.listStock.mock.calls.length).toBe(stockLoadsBeforeConfirmation + 1);
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

    expect(products.getOptions).toHaveBeenCalled();
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

  it('shows only cash actions granted to the cashier role', () => {
    sessionState.set({
      user: {
        id: 'cashier',
        email: 'cashier@example.com',
        roles: ['CASHIER'],
        permissions: ['SALES_MANAGE', 'CASH_REGISTER_OPEN'],
      },
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

    expect(
      (fixture.nativeElement.querySelector('.cash-movements form') as HTMLFormElement).hidden,
    ).toBe(true);
    expect(
      (fixture.nativeElement.querySelector('.cash-closure-form') as HTMLFormElement).hidden,
    ).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Punto de venta');
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
      [],
    );
  });

  it('quotes a cart and prevents duplicate cash sale submission', () => {
    customers.list.mockReturnValue(
      of({
        data: [
          {
            id: 'customer',
            name: 'Ana Pérez',
            identifier: 'ANA-1',
            email: 'ana@example.com',
            phone: null,
            dataProcessingConsent: true,
            active: true,
            version: 1,
            createdAt: '2026-08-27T13:00:00.000Z',
            updatedAt: '2026-08-27T13:00:00.000Z',
          },
        ],
        meta: {
          apiVersion: '1',
          pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
        },
      }),
    );
    (fixture.componentInstance as unknown as { searchCustomers(): void }).searchCustomers();
    fixture.detectChanges();
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
    (
      fixture.nativeElement.querySelector(
        '.product-search-panel .pos-results button',
      ) as HTMLButtonElement
    ).click();
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
    pos.createSale.mockReturnValue(saleResponse);
    const customerSelect = fixture.nativeElement.querySelector('#posCustomer') as HTMLSelectElement;
    customerSelect.value = 'customer';
    customerSelect.dispatchEvent(new Event('change', { bubbles: true }));
    fill('cashReceived', '250.00');
    (fixture.componentInstance as unknown as { completeCashSale(): void }).completeCashSale();
    (fixture.componentInstance as unknown as { completeCashSale(): void }).completeCashSale();

    expect(pos.createSale).toHaveBeenCalledTimes(1);
    expect(pos.createSale).toHaveBeenCalledWith(
      {
        lines: [{ productId: 'product', quantity: '2' }],
        customerId: 'customer',
        payments: [{ method: 'CASH', amount: '239.80', amountReceived: '250.00' }],
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
            id: 'sale-line-1',
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
          id: 'payment-1',
          method: 'CASH',
          status: 'COMPLETED',
          amountReceived: '250.00',
          amountApplied: '239.80',
          change: '10.20',
          reference: null,
          provider: 'INTERNAL',
          authorizationCode: null,
        },
        payments: [
          {
            id: 'payment-1',
            method: 'CASH',
            status: 'COMPLETED',
            amountReceived: '250.00',
            amountApplied: '239.80',
            change: '10.20',
            reference: null,
            provider: 'INTERNAL',
            authorizationCode: null,
          },
        ],
        createdAt: new Date().toISOString(),
        void: null,
      },
      meta: { apiVersion: '1', idempotentReplay: false },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Venta V-123456789012 completada');
    expect(fixture.nativeElement.textContent).toContain('Cambio MXN 10.20');
    expect(pos.openCashDrawer).toHaveBeenCalledWith(
      { trigger: 'CASH_SALE_COMPLETED', saleId: 'sale' },
      'web-drawer-sale-sale',
    );
    expect(fixture.nativeElement.textContent).toContain('Cajon abierto en SIM-register');
    expect(inventory.listStock).toHaveBeenCalledTimes(2);
    expect(pos.listSales).toHaveBeenCalledTimes(2);
  });

  it('suspends a cart and presents recalculation conflicts when it is resumed', () => {
    const product = {
      id: 'product',
      name: 'Café',
      sku: 'CAFE-1',
      barcode: '7501',
      trackLots: false,
      trackSerials: false,
      category: null,
      brand: null,
      cost: '80.00',
      price: '119.90',
      active: true,
      version: 1,
    };
    const quote = {
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
          quantity: '1.000',
          lotId: null,
          serialNumbers: [],
          availableQuantity: '5.000',
          unitPrice: '119.90',
          subtotal: '103.36',
          tax: '16.54',
          total: '119.90',
        },
      ],
      totals: { subtotal: '103.36', tax: '16.54', total: '119.90' },
    };
    const suspended = {
      id: '11111111-1111-4111-8111-111111111111',
      status: 'ACTIVE' as const,
      context: quote.context,
      author: { id: 'user', email: 'admin@example.com' },
      customer: null,
      notes: 'Cliente regresa',
      lines: [
        {
          product: { id: 'product', name: 'Café', sku: 'CAFE-1' },
          quantity: '1.000',
          lotId: null,
          serialNumbers: [],
          unitPriceSnapshot: '119.90',
          availableQuantitySnapshot: '5.000',
        },
      ],
      completedSaleId: null,
      expiresAt: '2026-08-29T18:00:00.000Z',
      createdAt: '2026-08-28T18:00:00.000Z',
      cancelledAt: null,
      resumedAt: null,
    };
    const component = fixture.componentInstance as unknown as {
      cart: { set(value: unknown[]): void };
      cartQuote: { set(value: typeof quote | null): void };
      cashForm: { controls: { notes: { setValue(value: string): void } } };
      suspendCurrentSale(): void;
      resumeSuspendedSale(value: typeof suspended): void;
    };
    component.cart.set([{ product, quantity: '1', lotId: '', lots: [], serialNumbers: '' }]);
    component.cartQuote.set(quote);
    component.cashForm.controls.notes.setValue('Cliente regresa');
    pos.suspendSale.mockReturnValue(
      of({ data: suspended, meta: { apiVersion: '1', idempotentReplay: false } }),
    );

    component.suspendCurrentSale();
    fixture.detectChanges();

    expect(pos.suspendSale).toHaveBeenCalledWith(
      {
        lines: [{ productId: 'product', quantity: '1' }],
        notes: 'Cliente regresa',
      },
      expect.stringMatching(/^web-suspend-/),
    );
    expect(fixture.nativeElement.textContent).toContain('Venta suspendida hasta');

    const currentQuote = {
      ...quote,
      lines: [{ ...quote.lines[0], unitPrice: '129.90', total: '129.90' }],
      totals: { subtotal: '112.00', tax: '17.90', total: '129.90' },
    };
    pos.resumeSuspendedSale.mockReturnValue(
      of({
        data: {
          suspendedSale: suspended,
          quote: currentQuote,
          conflicts: [
            {
              code: 'PRICE_CHANGED',
              productId: 'product',
              previous: '119.90',
              current: '129.90',
            },
          ],
        },
        meta: { apiVersion: '1', recalculatedAt: '2026-08-28T18:05:00.000Z' },
      }),
    );

    component.resumeSuspendedSale(suspended);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Carrito reanudado y recalculado');
    expect(fixture.nativeElement.textContent).toContain('precio 119.90 → 129.90');
  });

  it('queues a cash sale with the original idempotency key when the response is lost', async () => {
    const product = {
      id: 'product',
      name: 'Café',
      sku: 'CAFE-1',
      barcode: '7501',
      category: null,
      brand: null,
      cost: '1.20',
      price: '116.00',
      active: true,
      version: 1,
    };
    const quote = {
      context: {
        branch: { id: 'branch', name: 'Sucursal' },
        warehouse: { id: 'warehouse', name: 'Bodega' },
        cashRegister: { id: 'register', name: 'Caja', code: 'MAIN' },
      },
      currency: 'MXN',
      taxRate: '0.1600',
      lines: [
        {
          id: 'sale-line-1',
          product: { id: 'product', name: 'Café', sku: 'CAFE-1' },
          quantity: '1.000',
          availableQuantity: '5.000',
          unitPrice: '116.00',
          subtotal: '100.00',
          tax: '16.00',
          total: '116.00',
        },
      ],
      totals: { subtotal: '100.00', tax: '16.00', total: '116.00' },
    };
    const component = fixture.componentInstance as unknown as {
      cart: { set(value: Array<{ product: typeof product; quantity: string }>): void };
      cartQuote: { set(value: typeof quote): void };
      paymentRows: {
        at(index: number): {
          controls: {
            amount: { setValue(value: string): void };
            amountReceived: { setValue(value: string): void };
          };
        };
      };
      completeCashSale(): void;
    };
    component.cart.set([{ product, quantity: '1' }]);
    component.cartQuote.set(quote);
    component.paymentRows.at(0).controls.amount.setValue('116.00');
    component.paymentRows.at(0).controls.amountReceived.setValue('120.00');
    pos.createSale.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Offline' })),
    );
    offlinePos.queueCashSale.mockResolvedValue({ commandId: 'offline-command-1' });

    component.completeCashSale();
    await fixture.whenStable();
    fixture.detectChanges();

    const idempotencyKey = pos.createSale.mock.calls[0][1] as string;
    expect(offlinePos.queueCashSale).toHaveBeenCalledWith(
      quote,
      { lines: [{ productId: 'product', quantity: '1' }], cashReceived: '120.00' },
      idempotencyKey,
    );
    expect(fixture.nativeElement.textContent).toContain('Venta pendiente de confirmación');
    expect(fixture.nativeElement.textContent).toContain('Sólo efectivo, sin sobreventa');
  });

  it('submits referenced and mixed payments and explains a simulated rejection', () => {
    const product = {
      id: 'product',
      name: 'Café',
      sku: 'CAFE-1',
      barcode: '7501',
      category: null,
      brand: null,
      cost: '1.20',
      price: '116.00',
      active: true,
      version: 1,
    };
    const quote = {
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
          quantity: '1.000',
          availableQuantity: '5.000',
          unitPrice: '116.00',
          subtotal: '100.00',
          tax: '16.00',
          total: '116.00',
        },
      ],
      totals: { subtotal: '100.00', tax: '16.00', total: '116.00' },
    };
    const component = fixture.componentInstance as unknown as {
      cart: { set(value: Array<{ product: typeof product; quantity: string }>): void };
      cartQuote: { set(value: typeof quote): void };
      paymentRows: {
        at(index: number): {
          controls: {
            method: { setValue(value: string): void };
            amount: { setValue(value: string): void };
            amountReceived: { setValue(value: string): void };
            reference: { setValue(value: string): void };
          };
        };
      };
      changePaymentMethod(index: number): void;
      addPayment(): void;
      completeCashSale(): void;
    };
    component.cart.set([{ product, quantity: '1' }]);
    component.cartQuote.set(quote);
    component.paymentRows.at(0).controls.method.setValue('CARD');
    component.changePaymentMethod(0);
    component.paymentRows.at(0).controls.amount.setValue('116.00');
    component.paymentRows.at(0).controls.reference.setValue('DECLINE-001');
    pos.createSale.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { code: 'PAYMENT_DECLINED' },
          }),
      ),
    );

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Autorización simulada');
    component.completeCashSale();
    fixture.detectChanges();

    expect(pos.createSale).toHaveBeenCalledWith(
      {
        lines: [{ productId: 'product', quantity: '1' }],
        payments: [{ method: 'CARD', amount: '116.00', reference: 'DECLINE-001' }],
      },
      expect.stringMatching(/^web-sale-/),
    );
    expect(fixture.nativeElement.textContent).toContain('El pago fue rechazado');

    component.paymentRows.at(0).controls.reference.setValue('CARD-OK-001');
    component.addPayment();
    component.paymentRows.at(0).controls.amount.setValue('56.00');
    component.paymentRows.at(1).controls.amount.setValue('60.00');
    component.paymentRows.at(1).controls.amountReceived.setValue('70.00');
    pos.createSale.mockReturnValue(new Subject());
    component.completeCashSale();

    expect(pos.createSale).toHaveBeenLastCalledWith(
      {
        lines: [{ productId: 'product', quantity: '1' }],
        payments: [
          { method: 'CARD', amount: '56.00', reference: 'CARD-OK-001' },
          { method: 'CASH', amount: '60.00', amountReceived: '70.00' },
        ],
      },
      expect.stringMatching(/^web-sale-/),
    );
  });

  it('filters and reconciles the sales and cash report', () => {
    pos.salesCashReport.mockReturnValue(
      of({
        data: {
          scope: [{ id: 'branch', name: 'Sucursal', timezone: 'America/Mexico_City' }],
          options: {
            branches: [{ id: 'branch', name: 'Sucursal', timezone: 'America/Mexico_City' }],
            registers: [{ id: 'register', name: 'Caja', code: 'MAIN', branch_id: 'branch' }],
            users: [{ id: 'user', email: 'admin@example.com' }],
          },
          summary: {
            sales: {
              total: 2,
              completed: 1,
              voided: 1,
              net: '119.90',
              voidedAmount: '119.90',
            },
            payments: [
              { method: 'CASH', status: 'COMPLETED', count: 1, amount: '60.00' },
              { method: 'CARD', status: 'COMPLETED', count: 1, amount: '59.90' },
            ],
            cash: {
              shifts: 1,
              open: 0,
              closed: 1,
              expected: '310.00',
              counted: '310.00',
              difference: '0.00',
            },
            reconciliation: {
              salesNet: '119.90',
              paymentsApplied: '119.90',
              matches: true,
            },
          },
          sales: [
            {
              id: 'sale-report',
              receiptNumber: 'V-REPORT000001',
              status: 'COMPLETED',
              branch: { id: 'branch', name: 'Sucursal' },
              cashRegister: { id: 'register', name: 'Caja', code: 'MAIN' },
              user: { id: 'user', email: 'admin@example.com' },
              currency: 'MXN',
              total: '119.90',
              payments: [
                {
                  method: 'CASH',
                  status: 'COMPLETED',
                  amount: '60.00',
                  change: '10.00',
                  reference: null,
                },
                {
                  method: 'CARD',
                  status: 'COMPLETED',
                  amount: '59.90',
                  change: '0.00',
                  reference: 'CARD-001',
                },
              ],
              createdAt: '2026-08-27T14:00:00.000Z',
              voidedAt: null,
            },
          ],
          shifts: [
            {
              id: 'shift-report',
              status: 'CLOSED',
              branch: { id: 'branch', name: 'Sucursal' },
              cashRegister: { id: 'register', name: 'Caja', code: 'MAIN' },
              openedByEmail: 'admin@example.com',
              currency: 'MXN',
              opening: '250.00',
              expected: '310.00',
              counted: '310.00',
              difference: '0.00',
              openedAt: '2026-08-27T13:00:00.000Z',
              closedAt: '2026-08-27T15:00:00.000Z',
            },
          ],
          total: 2,
        },
        meta: {
          apiVersion: '1',
          pagination: { page: 1, pageSize: 10, total: 2, totalPages: 1 },
          periodTimezone: 'BRANCH_LOCAL',
        },
      }),
    );
    const component = fixture.componentInstance as unknown as {
      salesCashReportForm: {
        controls: {
          dateFrom: { setValue(value: string): void };
          dateTo: { setValue(value: string): void };
          branchId: { setValue(value: string): void };
          status: { setValue(value: 'ALL' | 'COMPLETED' | 'VOIDED'): void };
        };
      };
      filterSalesCashReport(): void;
    };
    component.salesCashReportForm.controls.dateFrom.setValue('2026-08-27');
    component.salesCashReportForm.controls.dateTo.setValue('2026-08-27');
    component.salesCashReportForm.controls.branchId.setValue('branch');
    component.salesCashReportForm.controls.status.setValue('ALL');
    component.filterSalesCashReport();
    fixture.detectChanges();

    expect(pos.salesCashReport).toHaveBeenLastCalledWith({
      dateFrom: '2026-08-27',
      dateTo: '2026-08-27',
      branchId: 'branch',
      status: 'ALL',
      page: 1,
      pageSize: 10,
    });
    expect(fixture.nativeElement.textContent).toContain('Conciliación correcta');
    expect(fixture.nativeElement.textContent).toContain('V-REPORT000001');
    expect(fixture.nativeElement.textContent).toContain('Diferencia 0.00');
  });

  it('creates a customer only after contact consent and selects it for the sale', () => {
    const customer = {
      id: 'customer',
      name: 'Ana Pérez',
      identifier: 'ANA-1',
      email: 'ana@example.com',
      phone: null,
      dataProcessingConsent: true,
      active: true,
      version: 1,
      createdAt: '2026-08-27T13:00:00.000Z',
      updatedAt: '2026-08-27T13:00:00.000Z',
    };
    customers.create.mockReturnValue(of({ data: customer, meta: { apiVersion: '1' } }));

    fill('customerName', ' Ana Pérez ');
    fill('customerIdentifier', 'ANA-1');
    fill('customerEmail', 'ANA@EXAMPLE.COM');
    (fixture.nativeElement.querySelector('#customerName') as HTMLElement)
      .closest('form')
      ?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(customers.create).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Autoriza el tratamiento de datos');

    const consent = fixture.nativeElement.querySelector(
      '[formControlName="dataProcessingConsent"]',
    ) as HTMLInputElement;
    consent.click();
    (fixture.nativeElement.querySelector('#customerName') as HTMLElement)
      .closest('form')
      ?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(customers.create).toHaveBeenCalledWith({
      name: 'Ana Pérez',
      identifier: 'ANA-1',
      email: 'ana@example.com',
      dataProcessingConsent: true,
      active: true,
    });
    expect(
      (
        fixture.componentInstance as unknown as {
          cashForm: { controls: { customerId: { value: string } } };
        }
      ).cashForm.controls.customerId.value,
    ).toBe('customer');
  });

  it('voids a completed sale once and exposes the compensation result', () => {
    const completed: SaleDetailData = {
      id: 'sale-to-void',
      receiptNumber: 'V-VOID12345678',
      status: 'COMPLETED',
      context: {
        branch: { id: 'branch', name: 'Sucursal' },
        warehouse: { id: 'warehouse', name: 'Bodega' },
        cashRegister: { id: 'register', name: 'Caja', code: 'MAIN' },
      },
      user: { id: 'user', email: 'admin@example.com' },
      currency: 'MXN',
      taxRate: '0.1600',
      lines: [
        {
          id: 'sale-line-detail-1',
          product: { id: 'product', name: 'Café', sku: 'CAFE-1' },
          quantity: '1.000',
          unitPrice: '119.90',
          subtotal: '103.36',
          tax: '16.54',
          total: '119.90',
        },
      ],
      totals: { subtotal: '103.36', tax: '16.54', total: '119.90' },
      payment: {
        id: 'payment-detail-1',
        method: 'CASH',
        status: 'COMPLETED',
        amountReceived: '120.00',
        amountApplied: '119.90',
        change: '0.10',
        reference: null,
        provider: 'INTERNAL',
        authorizationCode: null,
      },
      payments: [
        {
          id: 'payment-detail-1',
          method: 'CASH',
          status: 'COMPLETED',
          amountReceived: '120.00',
          amountApplied: '119.90',
          change: '0.10',
          reference: null,
          provider: 'INTERNAL',
          authorizationCode: null,
        },
      ],
      createdAt: '2026-08-27T14:30:00.000Z',
      void: null,
      movements: [
        {
          id: 'sale-movement',
          type: 'SALE',
          saleLineId: 'line',
          product: { id: 'product', name: 'Café', sku: 'CAFE-1' },
          location: { id: 'location', name: 'General', code: 'GENERAL' },
          quantityChange: '-1.000',
          resultingQuantity: '4.000',
          reference: 'V-VOID12345678',
          createdAt: '2026-08-27T14:30:00.000Z',
        },
      ],
    };
    pos.getSale.mockReturnValue(of({ data: completed, meta: { apiVersion: '1' } }));
    pos.listSales.mockReturnValue(
      of({
        data: [
          {
            id: completed.id,
            receiptNumber: completed.receiptNumber,
            status: completed.status,
            user: completed.user,
            cashRegister: completed.context.cashRegister,
            currency: completed.currency,
            total: completed.totals.total,
            paymentMethod: 'CASH',
            createdAt: completed.createdAt,
          },
        ],
        meta: {
          apiVersion: '1',
          pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
        },
      }),
    );
    fixture.destroy();
    inventory.listStock.mockClear();
    inventory.listMovements.mockClear();
    pos.listCashMovements.mockClear();
    audit.list.mockClear();
    fixture = TestBed.createComponent(ApplicationPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.sale-void-form')).toBeTruthy();
    const response = new Subject<{
      data: SaleDetailData;
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>();
    pos.voidSale.mockReturnValue(response);
    fill('saleVoidReason', 'Error de captura confirmado');
    (fixture.componentInstance as unknown as { voidSelectedSale(): void }).voidSelectedSale();
    (fixture.componentInstance as unknown as { voidSelectedSale(): void }).voidSelectedSale();

    expect(pos.voidSale).toHaveBeenCalledTimes(1);
    expect(pos.voidSale).toHaveBeenCalledWith(
      completed.id,
      'Error de captura confirmado',
      expect.stringMatching(/^web-sale-void-/),
    );
    response.next({
      data: {
        ...completed,
        status: 'VOIDED',
        payment: { ...completed.payment, status: 'REVERSED' },
        payments: completed.payments.map((payment) => ({ ...payment, status: 'REVERSED' })),
        void: {
          reason: 'Error de captura confirmado',
          user: { id: 'user', email: 'admin@example.com' },
          voidedAt: '2026-08-27T14:35:00.000Z',
        },
        movements: [
          ...completed.movements,
          {
            ...completed.movements[0],
            id: 'void-movement',
            type: 'SALE_VOID',
            quantityChange: '1.000',
            resultingQuantity: '5.000',
          },
        ],
      },
      meta: { apiVersion: '1', idempotentReplay: false },
    });
    response.complete();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Venta anulada');
    expect(fixture.nativeElement.textContent).toContain('Error de captura confirmado');
    expect(fixture.nativeElement.textContent).toContain('Estado');
    expect(fixture.nativeElement.textContent).toContain('Revertido');
    expect(fixture.nativeElement.textContent).toContain('Anulación');
    expect(fixture.nativeElement.querySelector('.sale-void-form')).toBeNull();
    expect(inventory.listStock).toHaveBeenCalledTimes(2);
    expect(inventory.listMovements).toHaveBeenCalledTimes(2);
    expect(pos.listCashMovements).toHaveBeenCalledTimes(2);
    expect(audit.list).toHaveBeenCalledTimes(2);
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

  it('filters, pages and exports the immutable audit trail', () => {
    const event = {
      id: 'audit-event',
      tenantId: 'tenant',
      sequence: 21,
      action: 'INVENTORY_IMPORT_CONFIRMED',
      entityType: 'inventory_import_batch',
      entityId: 'batch',
      correlationId: 'correlation',
      origin: 'WEB' as const,
      metadata: { importedRows: 5 },
      retentionUntil: '2027-08-27T14:00:00.000Z',
      createdAt: '2026-08-27T14:00:00.000Z',
      actor: { id: 'user', email: 'admin@example.com' },
      impersonator: null,
      integrity: {
        valid: true,
        payloadHash: 'payload-hash',
        previousHash: 'previous-hash',
        hash: 'integrity-hash',
      },
    };
    audit.list.mockReturnValue(
      of({
        data: [event],
        meta: {
          apiVersion: '1',
          retention: { minimumDays: 365, policy: 'APPEND_ONLY' },
          integrity: { valid: true },
          pagination: { page: 1, pageSize: 20, total: 21, totalPages: 2 },
        },
      }),
    );
    audit.list.mockClear();

    fill('auditSearch', '  correlation  ');
    fill('auditAction', 'INVENTORY_IMPORT_CONFIRMED');
    fill('auditEntity', 'inventory_import_batch');
    fill('auditDateFrom', '2026-08-01');
    fill('auditDateTo', '2026-08-31');
    (fixture.componentInstance as unknown as { filterAuditEvents(): void }).filterAuditEvents();
    fixture.detectChanges();

    expect(audit.list).toHaveBeenCalledWith({
      q: 'correlation',
      action: 'INVENTORY_IMPORT_CONFIRMED',
      entityType: 'inventory_import_batch',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      page: 1,
      pageSize: 20,
    });
    expect(fixture.nativeElement.textContent).toContain('21 evento(s)');
    expect(fixture.nativeElement.textContent).toContain('Integridad verificada');
    expect(fixture.nativeElement.textContent).toContain(
      '#21 · Importación de inventario confirmada',
    );

    (fixture.componentInstance as unknown as { nextAuditPage(): void }).nextAuditPage();
    expect(audit.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, pageSize: 20 }));

    const createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn().mockReturnValue('blob:audit'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    audit.export.mockReturnValue(of(new Blob(['sequence,action'], { type: 'text/csv' })));

    (fixture.componentInstance as unknown as { exportAuditEvents(): void }).exportAuditEvents();

    expect(audit.export).toHaveBeenCalledWith(
      expect.objectContaining({
        q: 'correlation',
        action: 'INVENTORY_IMPORT_CONFIRMED',
        entityType: 'inventory_import_batch',
        page: 1,
        pageSize: 20,
      }),
    );
    expect(click).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:audit');

    click.mockRestore();
    if (createObjectUrlDescriptor) {
      Object.defineProperty(URL, 'createObjectURL', createObjectUrlDescriptor);
    } else {
      Reflect.deleteProperty(URL, 'createObjectURL');
    }
    if (revokeObjectUrlDescriptor) {
      Object.defineProperty(URL, 'revokeObjectURL', revokeObjectUrlDescriptor);
    } else {
      Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
  });
});
