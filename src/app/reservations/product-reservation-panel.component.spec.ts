import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { ProductApiService } from '../catalog/product-api.service';
import { CustomerApiService } from '../customers/customer-api.service';
import { InventoryApiService } from '../inventory/inventory-api.service';
import { PosApiService } from '../pos/pos-api.service';
import {
  ProductReservationApiService,
  ProductReservationData,
} from './product-reservation-api.service';
import { ProductReservationPanelComponent } from './product-reservation-panel.component';

describe('ProductReservationPanelComponent', () => {
  let fixture: ComponentFixture<ProductReservationPanelComponent>;
  const customer = {
    id: 'customer',
    name: 'Ana',
    identifier: null,
    email: null,
    phone: null,
    dataProcessingConsent: false,
    active: true,
    version: 1,
    createdAt: '2026-08-27T12:00:00.000Z',
    updatedAt: '2026-08-27T12:00:00.000Z',
  };
  const product = {
    id: 'product',
    name: 'Café',
    sku: 'CAFE-1',
    barcode: null,
    category: null,
    brand: null,
    cost: '50.00',
    price: '80.00',
    active: true,
    version: 1,
  };
  const api = { list: vi.fn(), create: vi.fn() };

  beforeEach(async () => {
    api.list.mockReset().mockReturnValue(of({ data: [], meta: { apiVersion: '1' } }));
    api.create.mockReset();
    await TestBed.configureTestingModule({
      imports: [ProductReservationPanelComponent],
      providers: [
        { provide: ProductReservationApiService, useValue: api },
        {
          provide: PosApiService,
          useValue: { quote: vi.fn(), createCashSale: vi.fn() },
        },
        {
          provide: CustomerApiService,
          useValue: {
            list: vi.fn().mockReturnValue(
              of({
                data: [customer],
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
                data: [product],
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
                data: [{ id: 'location', name: 'General', code: 'GENERAL' }],
                meta: { apiVersion: '1' },
              }),
            ),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProductReservationPanelComponent);
    fixture.detectChanges();
  });

  it('creates a multi-line reservation once and reloads the active list', () => {
    const response = new Subject<{
      data: ProductReservationData;
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>();
    api.create.mockReturnValue(response);
    const component = fixture.componentInstance as unknown as {
      form: {
        controls: {
          customerId: { setValue(value: string): void };
          locationId: { setValue(value: string): void };
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
      addLine(): void;
      submit(): void;
    };
    component.form.controls.customerId.setValue('customer');
    component.form.controls.locationId.setValue('location');
    component.lines.at(0).controls.productId.setValue('product');
    component.lines.at(0).controls.quantity.setValue('1.5');
    component.addLine();
    component.lines.at(1).controls.productId.setValue('product-2');
    component.lines.at(1).controls.quantity.setValue('2');
    component.submit();
    component.submit();

    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.create).toHaveBeenCalledWith(
      {
        customerId: 'customer',
        locationId: 'location',
        expiresInHours: 24,
        lines: [
          { productId: 'product', quantity: '1.5' },
          { productId: 'product-2', quantity: '2' },
        ],
      },
      expect.stringMatching(/^web-reservation-/),
    );
    response.next({
      data: {
        id: 'reservation',
        reservationNumber: 'R-123456789012',
        status: 'ACTIVE',
        customer: { id: 'customer', name: 'Ana', identifier: null },
        context: {
          branch: { id: 'branch', name: 'Sucursal' },
          warehouse: { id: 'warehouse', name: 'Bodega' },
          location: { id: 'location', name: 'General', code: 'GENERAL' },
        },
        responsible: { id: 'user', email: 'admin@example.com' },
        expiresAt: '2026-08-28T12:00:00.000Z',
        createdAt: '2026-08-27T12:00:00.000Z',
        closedAt: null,
        closureReason: null,
        sale: null,
        lines: [],
      },
      meta: { apiVersion: '1', idempotentReplay: false },
    });
    fixture.detectChanges();

    expect(api.list).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('creada y stock apartado');
  });
});
