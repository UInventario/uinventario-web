import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { ProductApiService } from '../catalog/product-api.service';
import { CustomerApiService } from '../customers/customer-api.service';
import { InventoryApiService } from '../inventory/inventory-api.service';
import { PosApiService } from '../pos/pos-api.service';
import { CustomerOrderApiService, CustomerOrderData } from './customer-order-api.service';
import { CustomerOrderPanelComponent } from './customer-order-panel.component';

describe('CustomerOrderPanelComponent', () => {
  let fixture: ComponentFixture<CustomerOrderPanelComponent>;
  const order: CustomerOrderData = {
    id: 'order-id',
    orderNumber: 'O-123',
    channel: 'WEB',
    priority: 'HIGH',
    status: 'DRAFT',
    version: 1,
    customer: { id: 'customer-id', name: 'Ana', identifier: null },
    context: {
      branch: { id: 'branch-id', name: 'Principal' },
      warehouse: { id: 'warehouse-id', name: 'Bodega' },
      cashRegister: { id: 'register-id', name: 'Caja', code: 'CAJA' },
      location: { id: 'location-id', name: 'General', code: 'GENERAL' },
    },
    currency: 'MXN',
    totals: { subtotal: '100.00', tax: '16.00', total: '116.00' },
    expiresInHours: 48,
    reservation: null,
    sale: null,
    lines: [
      {
        id: 'line-id',
        product: { id: 'product-id', name: 'Café', sku: 'CAFE-1' },
        quantity: '1.000',
        serialNumbers: [],
        total: '116.00',
      },
    ],
    payments: [
      {
        id: 'payment-id',
        method: 'CASH',
        amount: '116.00',
        amountReceived: '150.00',
        reference: null,
        status: 'PLANNED',
      },
    ],
    transitions: [],
    cancellationReason: null,
    createdAt: '2026-08-29T12:00:00.000Z',
    updatedAt: '2026-08-29T12:00:00.000Z',
  };
  const listResponse = {
    data: [order],
    meta: {
      apiVersion: '1' as const,
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    },
  };
  const api = { list: vi.fn(), create: vi.fn(), transition: vi.fn() };

  beforeEach(async () => {
    api.list.mockReset().mockReturnValue(of(listResponse));
    api.create.mockReset();
    api.transition.mockReset();
    await TestBed.configureTestingModule({
      imports: [CustomerOrderPanelComponent],
      providers: [
        { provide: CustomerOrderApiService, useValue: api },
        {
          provide: PosApiService,
          useValue: {
            getPaymentOptions: vi.fn().mockReturnValue(
              of({
                data: { methods: ['CASH', 'CARD'], nonCashProvider: 'SIMULATOR' },
                meta: { apiVersion: '1' },
              }),
            ),
          },
        },
        {
          provide: CustomerApiService,
          useValue: {
            list: vi.fn().mockReturnValue(
              of({
                data: [
                  {
                    id: 'customer-id',
                    name: 'Ana',
                    identifier: null,
                    email: null,
                    phone: null,
                    dataProcessingConsent: false,
                    active: true,
                    version: 1,
                    createdAt: '2026-08-29T12:00:00.000Z',
                    updatedAt: '2026-08-29T12:00:00.000Z',
                  },
                ],
                meta: { apiVersion: '1', pagination: { total: 1, totalPages: 1 } },
              }),
            ),
          },
        },
        {
          provide: ProductApiService,
          useValue: {
            list: vi.fn().mockReturnValue(
              of({
                data: [
                  {
                    id: 'product-id',
                    name: 'Café',
                    sku: 'CAFE-1',
                    barcode: null,
                    category: null,
                    brand: null,
                    cost: '50.00',
                    price: '100.00',
                    active: true,
                    version: 1,
                  },
                ],
                meta: { apiVersion: '1', pagination: { total: 1, totalPages: 1 } },
              }),
            ),
          },
        },
        {
          provide: InventoryApiService,
          useValue: {
            listLocations: vi.fn().mockReturnValue(
              of({
                data: [{ id: 'location-id', name: 'General', code: 'GENERAL' }],
                meta: { apiVersion: '1' },
              }),
            ),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CustomerOrderPanelComponent);
    fixture.detectChanges();
  });

  it('creates one order with a retained idempotency request while saving', () => {
    const response = new Subject<{
      data: CustomerOrderData;
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>();
    api.create.mockReturnValue(response);
    const component = fixture.componentInstance as unknown as {
      form: {
        controls: {
          customerId: { setValue(value: string): void };
          locationId: { setValue(value: string): void };
          amountReceived: { setValue(value: string): void };
        };
      };
      lines: {
        at(index: number): {
          controls: {
            productId: { setValue(value: string): void };
            quantity: { setValue(value: string): void };
          };
        };
      };
      submit(): void;
    };
    component.form.controls.customerId.setValue('customer-id');
    component.form.controls.locationId.setValue('location-id');
    component.form.controls.amountReceived.setValue('150.00');
    component.lines.at(0).controls.productId.setValue('product-id');
    component.lines.at(0).controls.quantity.setValue('1');
    component.submit();
    component.submit();

    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.create).toHaveBeenCalledWith(
      {
        channel: 'WEB',
        customerId: 'customer-id',
        locationId: 'location-id',
        priority: 'NORMAL',
        expiresInHours: 48,
        lines: [{ productId: 'product-id', quantity: '1' }],
        payments: [{ method: 'CASH', amountReceived: '150.00' }],
      },
      expect.stringMatching(/^web-order-create-/),
    );
    response.next({ data: order, meta: { apiVersion: '1', idempotentReplay: false } });
    fixture.detectChanges();

    expect(api.list).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Pedido O-123 creado');
  });

  it('advances a draft once and reloads the operational queue', () => {
    const response = new Subject<{
      data: CustomerOrderData;
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>();
    api.transition.mockReturnValue(response);
    const component = fixture.componentInstance as unknown as {
      transition(order: CustomerOrderData, action: 'confirm'): void;
    };
    component.transition(order, 'confirm');
    component.transition(order, 'confirm');

    expect(api.transition).toHaveBeenCalledTimes(1);
    expect(api.transition).toHaveBeenCalledWith(
      'order-id',
      'confirm',
      1,
      expect.stringMatching(/^web-order-confirm-/),
      undefined,
    );
    response.next({
      data: { ...order, status: 'CONFIRMED', version: 2 },
      meta: { apiVersion: '1', idempotentReplay: false },
    });
    fixture.detectChanges();

    expect(api.list).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('confirmado');
  });
});
