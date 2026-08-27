import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { SupplierApiService, SupplierData } from '../suppliers/supplier-api.service';
import {
  SupplierProductApiService,
  SupplierProductData,
} from '../suppliers/supplier-product-api.service';
import { PurchaseOrderApiService, PurchaseOrderData } from './purchase-order-api.service';
import { PurchaseOrderPanelComponent } from './purchase-order-panel.component';

describe('PurchaseOrderPanelComponent', () => {
  let fixture: ComponentFixture<PurchaseOrderPanelComponent>;
  let ordersApi: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  const supplier: SupplierData = {
    id: 'supplier',
    legalName: 'Proveedor Uno, S.A. de C.V.',
    tradeName: 'Proveedor Uno',
    countryCode: 'MX',
    identifierType: 'RFC',
    taxIdentifier: 'ABC010203AB1',
    active: true,
    version: 1,
    contacts: [],
    createdAt: '2026-08-27T15:00:00.000Z',
    updatedAt: '2026-08-27T15:00:00.000Z',
  };
  const supplierProduct: SupplierProductData = {
    id: 'supplier-product',
    supplier: { id: supplier.id, name: supplier.tradeName! },
    product: {
      id: 'product',
      name: 'Café molido',
      sku: 'CAFE-500',
      catalogCost: '85.40',
      catalogPrice: '119.90',
    },
    supplierCode: 'PROV-CAFE',
    minimumQuantity: null,
    active: true,
    version: 1,
    prices: [
      {
        id: 'price',
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
  const order: PurchaseOrderData = {
    id: 'order',
    folio: 'OC-000001',
    supplier: { id: supplier.id, name: supplier.tradeName! },
    currency: 'MXN',
    status: 'DRAFT',
    notes: 'Entregar por la mañana',
    subtotal: '200.00',
    total: '200.00',
    version: 1,
    lines: [
      {
        id: 'line',
        supplierProductId: supplierProduct.id,
        productId: supplierProduct.product.id,
        productName: supplierProduct.product.name,
        productSku: supplierProduct.product.sku,
        supplierCode: supplierProduct.supplierCode,
        quantity: '2.500',
        unitCost: '80.00',
        subtotal: '200.00',
        notes: 'Empaque sellado',
      },
    ],
    createdAt: '2026-08-27T15:00:00.000Z',
    updatedAt: '2026-08-27T15:00:00.000Z',
  };

  beforeEach(async () => {
    ordersApi = {
      list: vi.fn().mockReturnValue(
        of({
          data: [order],
          meta: {
            apiVersion: '1',
            pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
          },
        }),
      ),
      create: vi.fn(),
      update: vi.fn(),
    };
    const suppliersApi = {
      list: vi.fn().mockReturnValue(
        of({
          data: [supplier],
          meta: {
            apiVersion: '1',
            pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
          },
        }),
      ),
    };
    const supplierProductsApi = {
      list: vi.fn().mockReturnValue(
        of({
          data: [supplierProduct],
          meta: {
            apiVersion: '1',
            pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
          },
        }),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [PurchaseOrderPanelComponent],
      providers: [
        { provide: PurchaseOrderApiService, useValue: ordersApi },
        { provide: SupplierApiService, useValue: suppliersApi },
        { provide: SupplierProductApiService, useValue: supplierProductsApi },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PurchaseOrderPanelComponent);
    fixture.detectChanges();
  });

  function change(id: string, value: string): void {
    const control = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    control.value = value;
    control.dispatchEvent(new Event('change', { bubbles: true }));
    control.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  it('creates a draft from supplier products and displays server totals', () => {
    expect(fixture.nativeElement.textContent).toContain('OC-000001');
    expect(fixture.nativeElement.textContent).toContain('MXN 200.00');

    change('purchaseOrderSupplier', supplier.id);
    change('purchaseOrderProduct0', supplierProduct.id);
    (
      fixture.componentInstance as unknown as { productChanged(index: number): void }
    ).productChanged(0);
    fixture.detectChanges();
    change('purchaseOrderQuantity0', '2.500');
    expect(
      (fixture.nativeElement.querySelector('#purchaseOrderCost0') as HTMLInputElement).value,
    ).toBe('80.00');

    const response = new Subject<{ data: PurchaseOrderData; meta: { apiVersion: '1' } }>();
    ordersApi.create.mockReturnValue(response);
    (fixture.componentInstance as unknown as { submit(): void }).submit();
    (fixture.componentInstance as unknown as { submit(): void }).submit();

    expect(ordersApi.create).toHaveBeenCalledOnce();
    expect(ordersApi.create).toHaveBeenCalledWith({
      supplierId: supplier.id,
      currency: 'MXN',
      lines: [
        {
          supplierProductId: supplierProduct.id,
          quantity: '2.500',
          unitCost: '80.00',
        },
      ],
    });
    response.next({ data: order, meta: { apiVersion: '1' } });
    response.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Borrador OC-000001 creado.');
  });

  it('edits only a draft using its optimistic version', () => {
    (fixture.componentInstance as unknown as { edit(value: PurchaseOrderData): void }).edit(order);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement.querySelector('#purchaseOrderQuantity0') as HTMLInputElement).value,
    ).toBe('2.500');

    change('purchaseOrderQuantity0', '3.000');
    ordersApi.update.mockReturnValue(
      of({
        data: { ...order, total: '240.00', subtotal: '240.00', version: 2 },
        meta: { apiVersion: '1' },
      }),
    );
    (fixture.componentInstance as unknown as { submit(): void }).submit();
    expect(ordersApi.update).toHaveBeenCalledWith(
      order.id,
      expect.objectContaining({
        version: 1,
        supplierId: supplier.id,
        lines: [expect.objectContaining({ quantity: '3.000' })],
      }),
    );
  });
});
