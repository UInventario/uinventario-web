import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { AuthorizationService } from '../../../../core/authorization/authorization.service';
import { InventoryFacade } from '../../application/inventory.facade';
import { InventoryPage } from './inventory-page';

describe('InventoryPage', () => {
  const params = convertToParamMap({});
  const facade = {
    listLocations: vi.fn(),
    listStock: vi.fn(),
    listMovements: vi.fn(),
    getProduct: vi.fn(),
    createMovement: vi.fn(),
    createStateTransition: vi.fn(),
  };
  const authorization = { has: vi.fn() };
  const router = { navigate: vi.fn() };

  const stockPage = {
    items: [
      {
        product: {
          id: '10000000-0000-4000-8000-000000000001',
          name: 'Café a granel',
          sku: 'CAFE-GRANEL',
          active: true,
          trackLots: false,
          baseUnit: 'KILOGRAM',
          quantityPrecision: 3,
          minimumQuantity: '0.001',
        },
        availableQuantity: '4.250',
        totalQuantity: '5.000',
        states: [
          { code: 'RESERVED' as const, quantity: '0.750' },
          { code: 'DAMAGED' as const, quantity: '0.000' },
          { code: 'IN_TRANSIT' as const, quantity: '0.000' },
        ],
        averageUnitCost: '82.40',
        inventoryValue: '412.00',
        costing: { method: 'WEIGHTED_AVERAGE', currency: 'MXN', reconciled: true },
      },
    ],
    scope: {
      branch: { id: '20000000-0000-4000-8000-000000000001', name: 'Centro' },
      warehouse: { id: '30000000-0000-4000-8000-000000000001', name: 'Principal' },
    },
    currency: 'MXN',
    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    authorization.has.mockReturnValue(false);
    facade.listLocations.mockReturnValue(of([]));
    facade.listStock.mockReturnValue(of(stockPage));
    facade.listMovements.mockReturnValue(
      of({ items: [], branch: stockPage.scope.branch, pagination: stockPage.pagination }),
    );
    TestBed.configureTestingModule({
      imports: [InventoryPage],
      providers: [
        { provide: InventoryFacade, useValue: facade },
        { provide: AuthorizationService, useValue: authorization },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(params), snapshot: { queryParamMap: params } },
        },
      ],
    });
  });

  it('renders server stock and money while withholding mutation controls without permission', () => {
    const fixture = TestBed.createComponent(InventoryPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Café a granel');
    expect(element.textContent).toContain('4.250');
    expect(element.textContent).toContain('412.00 MXN');
    expect(element.textContent).not.toContain('Registrar movimiento');
    expect(element.querySelector('.row-actions button')).toBeNull();
  });

  it('shows the authorized action but keeps it disabled until a location exists', () => {
    authorization.has.mockReturnValue(true);
    const fixture = TestBed.createComponent(InventoryPage);
    fixture.detectChanges();

    const action = fixture.nativeElement.querySelector(
      '.page-header .primary',
    ) as HTMLButtonElement;
    expect(action.textContent).toContain('Registrar movimiento');
    expect(action.disabled).toBe(true);
  });

  it('renders a normalized stock error instead of stale table data', () => {
    facade.listStock.mockReturnValue(
      throwError(
        () =>
          new ApiError(
            'validation',
            'Datos inválidos.',
            422,
            'INVALID_STOCK_QUANTITY',
            'request-2',
            false,
          ),
      ),
    );
    const fixture = TestBed.createComponent(InventoryPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'La cantidad no es válida o dejaría el saldo negativo.',
    );
    expect(element.querySelector('[role="table"]')).toBeNull();
  });
});
