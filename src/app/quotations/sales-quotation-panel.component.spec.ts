import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { ProductApiService } from '../catalog/product-api.service';
import { CustomerApiService } from '../customers/customer-api.service';
import { PosApiService } from '../pos/pos-api.service';
import { ProductReservationApiService } from '../reservations/product-reservation-api.service';
import {
  SalesQuotationApiService,
  SalesQuotationData,
  SalesQuotationPreview,
} from './sales-quotation-api.service';
import { SalesQuotationPanelComponent } from './sales-quotation-panel.component';

describe('SalesQuotationPanelComponent', () => {
  let fixture: ComponentFixture<SalesQuotationPanelComponent>;
  const quotation: SalesQuotationData = {
    id: 'quotation-id',
    quotationNumber: 'COT-123',
    status: 'ACTIVE',
    version: 1,
    channel: 'WEB',
    customer: null,
    reservation: null,
    sale: null,
    context: {
      branch: { id: 'branch-id', name: 'Principal' },
      warehouse: { id: 'warehouse-id', name: 'Bodega' },
      cashRegister: { id: 'register-id', name: 'Caja', code: 'CAJA' },
    },
    currency: 'MXN',
    taxRate: '0.0000',
    discount: null,
    lines: [
      {
        product: { id: 'product-id', name: 'Café', sku: 'CAFE-1' },
        quantity: '1.000',
        lotId: null,
        serialNumbers: [],
        availableQuantity: '5.000',
        unitPrice: '100.00',
        priceSource: 'BASE',
        priceList: null,
        grossTotal: '100.00',
        discount: { line: null, sale: null, total: '0.00' },
        subtotal: '100.00',
        tax: '0.00',
        total: '100.00',
      },
    ],
    totals: {
      gross: '100.00',
      lineDiscount: '0.00',
      saleDiscount: '0.00',
      discount: '0.00',
      subtotal: '100.00',
      tax: '0.00',
      total: '100.00',
    },
    validUntil: '2030-08-30T12:00:00.000Z',
    notes: 'Propuesta',
    createdAt: '2026-08-29T12:00:00.000Z',
    updatedAt: '2026-08-29T12:00:00.000Z',
    convertedAt: null,
  };
  const listResponse = {
    data: [quotation],
    meta: {
      apiVersion: '1' as const,
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    },
  };
  const api = {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    preview: vi.fn(),
    convert: vi.fn(),
  };

  beforeEach(async () => {
    api.list.mockReset().mockReturnValue(of(listResponse));
    api.create.mockReset();
    api.update.mockReset();
    api.preview.mockReset();
    api.convert.mockReset();
    await TestBed.configureTestingModule({
      imports: [SalesQuotationPanelComponent],
      providers: [
        { provide: SalesQuotationApiService, useValue: api },
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
                data: [],
                meta: { apiVersion: '1', pagination: { total: 0, totalPages: 0 } },
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
          provide: ProductReservationApiService,
          useValue: {
            list: vi.fn().mockReturnValue(
              of({
                data: [],
                meta: { apiVersion: '1' },
              }),
            ),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SalesQuotationPanelComponent);
    fixture.detectChanges();
  });

  it('creates one stock-neutral quotation with a retained retry key', () => {
    const response = new Subject<{
      data: SalesQuotationData;
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>();
    api.create.mockReturnValue(response);
    const component = fixture.componentInstance as unknown as {
      lines: { at(index: number): { controls: { productId: { setValue(value: string): void } } } };
      submit(): void;
    };
    component.lines.at(0).controls.productId.setValue('product-id');
    component.submit();
    component.submit();

    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'WEB',
        lines: [{ productId: 'product-id', quantity: '1' }],
      }),
      expect.stringMatching(/^web-quotation-create-/),
    );
    response.next({ data: quotation, meta: { apiVersion: '1', idempotentReplay: false } });
    fixture.detectChanges();
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Cotización COT-123 creada');
  });

  it('shows recalculated differences and converts only once while pending', () => {
    const preview: SalesQuotationPreview = {
      quotation,
      recalculated: { ...quotation, totals: { ...quotation.totals, total: '110.00' } },
      differences: [
        {
          product: quotation.lines[0].product,
          field: 'UNIT_PRICE',
          quoted: '100.00',
          current: '110.00',
          blocking: false,
        },
      ],
      canConvert: true,
    };
    api.preview.mockReturnValue(
      of({ data: preview, meta: { apiVersion: '1', recalculatedAt: '2026-08-29T13:00:00.000Z' } }),
    );
    const response = new Subject<{
      data: {
        quotation: SalesQuotationData;
        sale: { id: string; receiptNumber: string };
        differences: [];
      };
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>();
    api.convert.mockReturnValue(response);
    const component = fixture.componentInstance as unknown as {
      paymentForm: { controls: { amountReceived: { setValue(value: string): void } } };
      preview(value: SalesQuotationData): void;
      convert(): void;
    };
    component.preview(quotation);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('100.00 → 110.00');
    component.paymentForm.controls.amountReceived.setValue('150.00');
    component.convert();
    component.convert();

    expect(api.convert).toHaveBeenCalledTimes(1);
    expect(api.convert).toHaveBeenCalledWith(
      'quotation-id',
      {
        version: 1,
        acceptDifferences: true,
        payments: [{ method: 'CASH', amountReceived: '150.00' }],
      },
      expect.stringMatching(/^web-quotation-convert-/),
    );
    response.next({
      data: {
        quotation: {
          ...quotation,
          status: 'CONVERTED',
          sale: { id: 'sale-id', receiptNumber: 'V-1' },
        },
        sale: { id: 'sale-id', receiptNumber: 'V-1' },
        differences: [],
      },
      meta: { apiVersion: '1', idempotentReplay: false },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('convertida en V-1');
  });
});
