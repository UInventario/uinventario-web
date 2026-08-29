import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { ProductApiService, ProductData } from '../catalog/product-api.service';
import { CustomerApiService, CustomerData } from '../customers/customer-api.service';
import { CollectedPaymentMethod, PosApiService } from '../pos/pos-api.service';
import {
  ProductReservationApiService,
  ProductReservationData,
} from '../reservations/product-reservation-api.service';
import {
  SalesQuotationApiService,
  SalesQuotationData,
  SalesQuotationInput,
  SalesQuotationPreview,
  SalesQuotationStatus,
} from './sales-quotation-api.service';

const QUANTITY_PATTERN = /^(?:[1-9]\d*(?:\.\d{1,3})?|0\.(?:00[1-9]|0[1-9]\d?|[1-9]\d{0,2}))$/;
const MONEY_PATTERN = /^(0|[1-9]\d{0,11})(\.\d{1,2})?$/;
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{3,119}$/;

@Component({
  selector: 'app-sales-quotation-panel',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './sales-quotation-panel.component.html',
  styleUrl: './sales-quotation-panel.component.scss',
})
export class SalesQuotationPanelComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(SalesQuotationApiService);
  private readonly customersApi = inject(CustomerApiService);
  private readonly productsApi = inject(ProductApiService);
  private readonly reservationsApi = inject(ProductReservationApiService);
  private readonly posApi = inject(PosApiService);
  private pendingSave: { signature: string; key: string } | null = null;
  private pendingConversion: { quotationId: string; signature: string; key: string } | null = null;

  protected readonly customers = signal<CustomerData[]>([]);
  protected readonly products = signal<ProductData[]>([]);
  protected readonly reservations = signal<ProductReservationData[]>([]);
  protected readonly paymentMethods = signal<CollectedPaymentMethod[]>(['CASH']);
  protected readonly quotations = signal<SalesQuotationData[]>([]);
  protected readonly editing = signal<SalesQuotationData | null>(null);
  protected readonly conversion = signal<SalesQuotationPreview | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly converting = signal(false);
  protected readonly previewingId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(0);
  protected readonly total = signal(0);

  protected readonly filterForm = this.formBuilder.nonNullable.group({
    status: ['' as '' | SalesQuotationStatus],
  });
  protected readonly form = this.formBuilder.nonNullable.group({
    customerId: [''],
    reservationId: [''],
    channel: ['WEB' as SalesQuotationData['channel'], Validators.required],
    validUntil: [this.defaultValidity(), Validators.required],
    notes: ['', Validators.maxLength(1000)],
    lines: this.formBuilder.array([this.lineGroup()]),
  });
  protected readonly paymentForm = this.formBuilder.nonNullable.group({
    method: ['CASH' as CollectedPaymentMethod, Validators.required],
    amountReceived: ['', Validators.pattern(MONEY_PATTERN)],
    reference: ['', Validators.pattern(REFERENCE_PATTERN)],
  });

  protected get lines(): FormArray<ReturnType<SalesQuotationPanelComponent['lineGroup']>> {
    return this.form.controls.lines;
  }

  ngOnInit(): void {
    this.load();
  }

  protected addLine(): void {
    if (this.lines.length < 100) this.lines.push(this.lineGroup());
  }

  protected removeLine(index: number): void {
    if (this.lines.length > 1) this.lines.removeAt(index);
  }

  protected reservationChanged(): void {
    const reservation = this.reservations().find(
      ({ id }) => id === this.form.controls.reservationId.value,
    );
    if (!reservation) return;
    this.form.controls.customerId.setValue(reservation.customer.id);
    this.lines.clear();
    for (const line of reservation.lines)
      this.lines.push(this.lineGroup(line.product.id, line.quantity));
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    if (new Set(raw.lines.map(({ productId }) => productId)).size !== raw.lines.length) {
      this.error.set('Cada producto debe aparecer una sola vez.');
      return;
    }
    const validUntil = new Date(raw.validUntil);
    if (!Number.isFinite(validUntil.getTime()) || validUntil.getTime() <= Date.now()) {
      this.error.set('La vigencia debe ser posterior al momento actual.');
      return;
    }
    const input: SalesQuotationInput = {
      ...(raw.customerId ? { customerId: raw.customerId } : {}),
      ...(raw.reservationId ? { reservationId: raw.reservationId } : {}),
      channel: raw.channel,
      validUntil: validUntil.toISOString(),
      ...(raw.notes.trim() ? { notes: raw.notes.trim() } : {}),
      lines: raw.lines.map(({ productId, quantity }) => ({ productId, quantity: quantity.trim() })),
    };
    const current = this.editing();
    const signature = JSON.stringify({
      id: current?.id ?? null,
      version: current?.version ?? null,
      input,
    });
    const pending = this.pendingSave;
    const request =
      pending?.signature === signature
        ? pending
        : {
            signature,
            key: `web-quotation-${current ? 'update' : 'create'}-${crypto.randomUUID()}`,
          };
    this.pendingSave = request;
    this.saving.set(true);
    this.clearMessages();
    const operation = current
      ? this.api.update(current.id, { ...input, version: current.version }, request.key)
      : this.api.create(input, request.key);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: ({ data }) => {
        this.pendingSave = null;
        this.success.set(
          `Cotización ${data.quotationNumber} ${current ? 'actualizada' : 'creada'}.`,
        );
        this.cancelEditing();
        this.loadQuotations(1);
      },
      error: (error: HttpErrorResponse) => {
        if (error.status > 0 && error.status < 500) this.pendingSave = null;
        this.error.set(this.message(error));
        if (error.status === 409) this.loadQuotations(this.page());
      },
    });
  }

  protected edit(quotation: SalesQuotationData): void {
    if (quotation.status !== 'ACTIVE') return;
    this.editing.set(quotation);
    this.form.patchValue({
      customerId: quotation.customer?.id ?? '',
      reservationId: quotation.reservation?.id ?? '',
      channel: quotation.channel,
      validUntil: this.localDate(quotation.validUntil),
      notes: quotation.notes ?? '',
    });
    this.lines.clear();
    for (const line of quotation.lines)
      this.lines.push(this.lineGroup(line.product.id, line.quantity));
    this.conversion.set(null);
    this.clearMessages();
  }

  protected cancelEditing(): void {
    this.editing.set(null);
    this.form.reset({
      customerId: '',
      reservationId: '',
      channel: 'WEB',
      validUntil: this.defaultValidity(),
      notes: '',
    });
    this.lines.clear();
    this.lines.push(this.lineGroup());
  }

  protected preview(quotation: SalesQuotationData): void {
    if (this.previewingId()) return;
    this.previewingId.set(quotation.id);
    this.clearMessages();
    this.api
      .preview(quotation.id)
      .pipe(finalize(() => this.previewingId.set(null)))
      .subscribe({
        next: ({ data }) => {
          this.conversion.set(data);
          this.paymentForm.reset({
            method: this.paymentMethods()[0] ?? 'CASH',
            amountReceived: '',
            reference: '',
          });
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  protected dismissConversion(): void {
    this.conversion.set(null);
  }

  protected paymentChanged(): void {
    this.paymentForm.patchValue({ amountReceived: '', reference: '' });
  }

  protected convert(): void {
    const preview = this.conversion();
    if (!preview || !preview.canConvert || this.paymentForm.invalid || this.converting()) {
      this.paymentForm.markAllAsTouched();
      return;
    }
    const payment = this.paymentForm.getRawValue();
    if (payment.method === 'CASH' && !payment.amountReceived.trim()) {
      this.error.set('Indica el efectivo recibido.');
      return;
    }
    if (payment.method !== 'CASH' && !payment.reference.trim()) {
      this.error.set('Indica la referencia del pago.');
      return;
    }
    const input = {
      version: preview.quotation.version,
      acceptDifferences: true,
      payments: [
        payment.method === 'CASH'
          ? { method: payment.method, amountReceived: payment.amountReceived.trim() }
          : { method: payment.method, reference: payment.reference.trim() },
      ],
    };
    const signature = JSON.stringify(input);
    const pending = this.pendingConversion;
    const request =
      pending?.quotationId === preview.quotation.id && pending.signature === signature
        ? pending
        : {
            quotationId: preview.quotation.id,
            signature,
            key: `web-quotation-convert-${crypto.randomUUID()}`,
          };
    this.pendingConversion = request;
    this.converting.set(true);
    this.clearMessages();
    this.api
      .convert(preview.quotation.id, input, request.key)
      .pipe(finalize(() => this.converting.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.pendingConversion = null;
          this.conversion.set(null);
          this.success.set(
            `Cotización ${data.quotation.quotationNumber} convertida en ${data.sale.receiptNumber}.`,
          );
          this.loadQuotations(this.page());
        },
        error: (error: HttpErrorResponse) => {
          if (error.status > 0 && error.status < 500) this.pendingConversion = null;
          if (error.error?.preview)
            this.conversion.set(error.error.preview as SalesQuotationPreview);
          this.error.set(this.message(error));
          if (error.status === 409) this.loadQuotations(this.page());
        },
      });
  }

  protected filter(): void {
    this.loadQuotations(1);
  }
  protected previousPage(): void {
    if (this.page() > 1) this.loadQuotations(this.page() - 1);
  }
  protected nextPage(): void {
    if (this.page() < this.totalPages()) this.loadQuotations(this.page() + 1);
  }
  protected statusLabel(status: SalesQuotationStatus): string {
    return {
      ACTIVE: 'Vigente',
      EXPIRED: 'Vencida',
      CONVERTING: 'Convirtiendo',
      CONVERTED: 'Convertida',
    }[status];
  }
  protected differenceLabel(field: 'UNIT_PRICE' | 'AVAILABLE_STOCK' | 'TOTAL'): string {
    return { UNIT_PRICE: 'Precio unitario', AVAILABLE_STOCK: 'Stock disponible', TOTAL: 'Total' }[
      field
    ];
  }

  private load(): void {
    this.loading.set(true);
    forkJoin({
      customers: this.customersApi.list({ status: 'ACTIVE', page: 1, pageSize: 100 }),
      products: this.productsApi.list({ status: 'ACTIVE', page: 1, pageSize: 100 }),
      reservations: this.reservationsApi.list(),
      payments: this.posApi.getPaymentOptions(),
      quotations: this.api.list({ page: 1, pageSize: 20 }),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ customers, products, reservations, payments, quotations }) => {
          this.customers.set(customers.data);
          this.products.set(products.data);
          this.reservations.set(reservations.data.filter(({ status }) => status === 'ACTIVE'));
          this.paymentMethods.set(payments.data.methods);
          if (!payments.data.methods.includes(this.paymentForm.controls.method.value))
            this.paymentForm.controls.method.setValue(payments.data.methods[0] ?? 'CASH');
          this.applyList(quotations);
        },
        error: () => this.error.set('No fue posible cargar las cotizaciones.'),
      });
  }

  private loadQuotations(page: number): void {
    this.loading.set(true);
    const status = this.filterForm.controls.status.value;
    this.api
      .list({ ...(status ? { status } : {}), page, pageSize: 20 })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => this.applyList(response),
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  private applyList(response: {
    data: SalesQuotationData[];
    meta: {
      pagination: {
        page: number;
        totalPages: number;
        total: number;
      };
    };
  }): void {
    this.quotations.set(response.data);
    this.page.set(response.meta.pagination.page);
    this.totalPages.set(response.meta.pagination.totalPages);
    this.total.set(response.meta.pagination.total);
  }

  private lineGroup(productId = '', quantity = '1') {
    return this.formBuilder.nonNullable.group({
      productId: [productId, Validators.required],
      quantity: [quantity, [Validators.required, Validators.pattern(QUANTITY_PATTERN)]],
    });
  }
  private defaultValidity(): string {
    return this.localDate(new Date(Date.now() + 24 * 60 * 60_000).toISOString());
  }
  private localDate(value: string): string {
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }
  private clearMessages(): void {
    this.error.set(null);
    this.success.set(null);
  }
  private message(error: HttpErrorResponse): string {
    const code = error.error?.code as string | undefined;
    if (code === 'QUOTATION_CHANGED')
      return 'Precio o total cambiaron. Revisa las diferencias antes de convertir.';
    if (code === 'QUOTATION_STOCK_CHANGED')
      return 'No hay stock suficiente para convertir esta cotización.';
    if (code === 'QUOTATION_VERSION_CONFLICT')
      return 'La cotización cambió; se actualizó la lista.';
    if (code === 'QUOTATION_NOT_ACTIVE') return 'La cotización ya no está vigente.';
    if (typeof error.error?.message === 'string') return error.error.message;
    if (error.status === 0) return 'No fue posible conectar con cotizaciones.';
    return 'No fue posible completar la operación de cotización.';
  }
}
