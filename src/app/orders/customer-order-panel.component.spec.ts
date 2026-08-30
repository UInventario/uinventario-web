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
    fulfillment: {
      method: 'PICKUP',
      status: 'PENDING',
      deliveryCost: '0.00',
      window: {
        start: '2026-08-29T13:00:00.000Z',
        end: '2026-08-29T15:00:00.000Z',
      },
      address: null,
      carrier: null,
      responsible: { preparation: null, delivery: null },
    },
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
  const api = {
    list: vi.fn(),
    create: vi.fn(),
    transition: vi.fn(),
    quoteShipping: vi.fn(),
    cancelShipping: vi.fn(),
    pollShipping: vi.fn(),
  };

  beforeEach(async () => {
    api.list.mockReset().mockReturnValue(of(listResponse));
    api.create.mockReset();
    api.transition.mockReset();
    api.quoteShipping.mockReset();
    api.cancelShipping.mockReset();
    api.pollShipping.mockReset();
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
      expect.objectContaining({
        channel: 'WEB',
        customerId: 'customer-id',
        locationId: 'location-id',
        priority: 'NORMAL',
        expiresInHours: 48,
        fulfillment: {
          method: 'PICKUP',
          deliveryCost: '0.00',
          windowStart: expect.any(String),
          windowEnd: expect.any(String),
        },
        lines: [{ productId: 'product-id', quantity: '1' }],
        payments: [{ method: 'CASH', amountReceived: '150.00' }],
      }),
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

  it('retries a recoverable simulated dispatch with a retained request key', () => {
    const response = new Subject<{
      data: CustomerOrderData;
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>();
    api.transition.mockReturnValue(response);
    const deliveryOrder: CustomerOrderData = {
      ...order,
      status: 'READY',
      version: 4,
      fulfillment: {
        method: 'DELIVERY',
        status: 'RETRYABLE_FAILURE',
        deliveryCost: '85.50',
        window: order.fulfillment.window,
        address: {
          recipientNameMasked: 'P***',
          phoneMasked: '***9876',
          summary: 'Ciudad de México, CDMX, MX',
          countryCode: 'MX',
        },
        carrier: {
          code: 'SIMULATED_RETRY',
          name: 'Transportista simulado con reintento',
          providerVersion: '1',
          trackingReference: null,
          label: null,
          trackingStatus: null,
          latestEventSequence: 0,
          latestEventAt: null,
          manualActionRequired: false,
          attempts: 1,
          lastErrorCode: 'SIMULATED_CARRIER_TIMEOUT',
          lastAttemptAt: '2026-08-29T13:00:00.000Z',
        },
        responsible: { preparation: null, delivery: null },
      },
    };
    const component = fixture.componentInstance as unknown as {
      transition(order: CustomerOrderData, action: 'dispatch'): void;
    };
    component.transition(deliveryOrder, 'dispatch');
    component.transition(deliveryOrder, 'dispatch');

    expect(api.transition).toHaveBeenCalledTimes(1);
    expect(api.transition).toHaveBeenCalledWith(
      'order-id',
      'dispatch',
      4,
      expect.stringMatching(/^web-order-dispatch-/),
      undefined,
    );
    response.next({
      data: {
        ...deliveryOrder,
        version: 5,
        fulfillment: {
          ...deliveryOrder.fulfillment,
          status: 'DISPATCHED',
          carrier: {
            ...deliveryOrder.fulfillment.carrier!,
            attempts: 2,
            trackingReference: 'SIM-O-123-2',
            label: { format: 'ZPL', payload: '^XA^FDO-123^FS^XZ' },
            trackingStatus: 'LABEL_READY',
            lastErrorCode: null,
          },
        },
      },
      meta: { apiVersion: '1', idempotentReplay: false },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('en tránsito');
  });

  it('quotes, displays a label and preserves manual fallback on carrier timeout', () => {
    const deliveryOrder: CustomerOrderData = {
      ...order,
      status: 'READY',
      version: 5,
      fulfillment: {
        method: 'DELIVERY',
        status: 'DISPATCHED',
        deliveryCost: '85.50',
        window: order.fulfillment.window,
        address: {
          recipientNameMasked: 'P***',
          phoneMasked: '***9876',
          summary: 'Ciudad de México, CDMX, MX',
          countryCode: 'MX',
        },
        carrier: {
          code: 'SIMULATED',
          name: 'Transportista simulado',
          providerVersion: '1',
          trackingReference: 'SIM-O-123-1',
          label: { format: 'ZPL', payload: '^XA^FDO-123^FS^XZ' },
          trackingStatus: 'LABEL_READY',
          latestEventSequence: 0,
          latestEventAt: null,
          manualActionRequired: false,
          attempts: 1,
          lastErrorCode: null,
          lastAttemptAt: '2026-08-29T13:00:00.000Z',
        },
        responsible: { preparation: null, delivery: null },
      },
    };
    api.quoteShipping.mockReturnValue(
      of({
        data: {
          quoteReference: 'QUOTE-O-123',
          service: 'SIMULATED_STANDARD',
          amount: '80.00',
          currency: 'MXN',
          estimatedDeliveryAt: order.fulfillment.window.end,
        },
        meta: { apiVersion: '1' },
      }),
    );
    api.cancelShipping.mockReturnValue(
      of({
        data: {
          ...deliveryOrder,
          fulfillment: {
            ...deliveryOrder.fulfillment,
            carrier: {
              ...deliveryOrder.fulfillment.carrier!,
              manualActionRequired: true,
              lastErrorCode: 'SIMULATED_CARRIER_CANCEL_TIMEOUT',
            },
          },
        },
        meta: { apiVersion: '1', idempotentReplay: false },
      }),
    );
    const component = fixture.componentInstance as unknown as {
      orders: { set(value: CustomerOrderData[]): void };
      quoteShipping(order: CustomerOrderData): void;
      cancelShipping(order: CustomerOrderData, scenario: 'TIMEOUT'): void;
    };
    component.orders.set([deliveryOrder]);
    fixture.detectChanges();
    component.quoteShipping(deliveryOrder);
    component.cancelShipping(deliveryOrder, 'TIMEOUT');
    fixture.detectChanges();

    expect(api.quoteShipping).toHaveBeenCalledWith(deliveryOrder.id);
    expect(api.cancelShipping).toHaveBeenCalledWith(
      deliveryOrder.id,
      'TIMEOUT',
      expect.stringMatching(/^web-shipping-cancel-/),
    );
    expect(fixture.nativeElement.textContent).toContain('SIMULATED_STANDARD');
    expect(fixture.nativeElement.textContent).toContain('Etiqueta ZPL');
    expect(fixture.nativeElement.textContent).toContain('Acción manual requerida');
  });
});
