import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin, Observable } from 'rxjs';
import { ProductApiService, ProductData } from '../catalog/product-api.service';
import { CustomerApiService, CustomerData } from '../customers/customer-api.service';
import { InventoryApiService, InventoryLocationData } from '../inventory/inventory-api.service';
import { PosApiService, PosCartQuote } from '../pos/pos-api.service';
import {
  ProductReservationApiService,
  ProductReservationData,
  ProductReservationInput,
} from './product-reservation-api.service';

const QUANTITY_PATTERN = /^(?:[1-9]\d*(?:\.\d{1,3})?|0\.(?:00[1-9]|0[1-9]\d?|[1-9]\d{0,2}))$/;

@Component({
  selector: 'app-product-reservation-panel',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './product-reservation-panel.component.html',
  styleUrl: './product-reservation-panel.component.scss',
})
export class ProductReservationPanelComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(ProductReservationApiService);
  private readonly customersApi = inject(CustomerApiService);
  private readonly productsApi = inject(ProductApiService);
  private readonly inventoryApi = inject(InventoryApiService);
  private readonly posApi = inject(PosApiService);
  private pending: { input: ProductReservationInput; key: string } | null = null;

  protected readonly customers = signal<CustomerData[]>([]);
  protected readonly products = signal<ProductData[]>([]);
  protected readonly locations = signal<InventoryLocationData[]>([]);
  protected readonly reservations = signal<ProductReservationData[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly actionBusy = signal(false);
  protected readonly saleReservation = signal<ProductReservationData | null>(null);
  protected readonly saleQuote = signal<PosCartQuote | null>(null);
  protected readonly cashReceived = this.formBuilder.nonNullable.control('', [
    Validators.required,
    Validators.pattern(/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/),
  ]);
  protected readonly form = this.formBuilder.nonNullable.group({
    customerId: ['', Validators.required],
    locationId: ['', Validators.required],
    expiresInHours: [24, [Validators.required, Validators.min(1), Validators.max(720)]],
    lines: this.formBuilder.array([this.lineGroup()]),
  });

  protected get lines(): FormArray<ReturnType<ProductReservationPanelComponent['lineGroup']>> {
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

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const input: ProductReservationInput = {
      customerId: raw.customerId,
      locationId: raw.locationId,
      expiresInHours: raw.expiresInHours,
      lines: raw.lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity.trim(),
      })),
    };
    const signature = JSON.stringify(input);
    const pending = this.pending;
    const key =
      pending?.input && JSON.stringify(pending.input) === signature
        ? pending.key
        : `web-reservation-${crypto.randomUUID()}`;
    this.pending = { input, key };
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api
      .create(input, key)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.pending = null;
          this.success.set(`Reserva ${data.reservationNumber} creada y stock apartado.`);
          this.resetForm();
          this.loadReservations();
        },
        error: (error: HttpErrorResponse) => {
          if (error.status > 0 && error.status < 500) this.pending = null;
          this.error.set(
            typeof error.error?.message === 'string'
              ? error.error.message
              : 'No fue posible crear la reserva.',
          );
        },
      });
  }

  protected release(reservation: ProductReservationData): void {
    if (this.actionBusy() || reservation.status !== 'ACTIVE') return;
    this.runAction(
      this.api.release(
        reservation.id,
        'Liberada por el usuario',
        `web-reservation-release-${crypto.randomUUID()}`,
      ),
      `Reserva ${reservation.reservationNumber} liberada.`,
    );
  }

  protected expireDue(): void {
    if (this.actionBusy()) return;
    this.runAction(this.api.expireDue(), 'Reservas vencidas procesadas.');
  }

  protected prepareSale(reservation: ProductReservationData): void {
    if (this.actionBusy() || reservation.status !== 'ACTIVE') return;
    this.actionBusy.set(true);
    this.error.set(null);
    this.posApi
      .quote(
        reservation.lines.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
        })),
        reservation.id,
      )
      .pipe(finalize(() => this.actionBusy.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.saleReservation.set(reservation);
          this.saleQuote.set(data);
          this.cashReceived.setValue(data.totals.total);
        },
        error: (error: HttpErrorResponse) => this.setActionError(error),
      });
  }

  protected consume(): void {
    const reservation = this.saleReservation();
    if (!reservation || this.cashReceived.invalid || this.actionBusy()) return;
    this.actionBusy.set(true);
    this.error.set(null);
    this.posApi
      .createCashSale(
        {
          reservationId: reservation.id,
          customerId: reservation.customer.id,
          lines: reservation.lines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
          })),
          cashReceived: this.cashReceived.value,
        },
        `web-reservation-sale-${crypto.randomUUID()}`,
      )
      .pipe(finalize(() => this.actionBusy.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.success.set(`Reserva consumida en la venta ${data.receiptNumber}.`);
          this.saleReservation.set(null);
          this.saleQuote.set(null);
          this.loadReservations();
        },
        error: (error: HttpErrorResponse) => this.setActionError(error),
      });
  }

  protected cancelSale(): void {
    this.saleReservation.set(null);
    this.saleQuote.set(null);
  }

  protected statusLabel(status: ProductReservationData['status']): string {
    return { ACTIVE: 'Activa', RELEASED: 'Liberada', EXPIRED: 'Vencida', CONSUMED: 'Consumida' }[
      status
    ];
  }

  private runAction(request: Observable<unknown>, message: string): void {
    this.actionBusy.set(true);
    this.error.set(null);
    request.pipe(finalize(() => this.actionBusy.set(false))).subscribe({
      next: () => {
        this.success.set(message);
        this.loadReservations();
      },
      error: (error: HttpErrorResponse) => this.setActionError(error),
    });
  }

  private setActionError(error: HttpErrorResponse): void {
    this.error.set(
      typeof error.error?.message === 'string'
        ? error.error.message
        : 'La reserva cambió o no fue posible completar la operación.',
    );
    if (error.status === 409) this.loadReservations();
  }

  private lineGroup() {
    return this.formBuilder.nonNullable.group({
      productId: ['', Validators.required],
      quantity: ['1', [Validators.required, Validators.pattern(QUANTITY_PATTERN)]],
    });
  }

  private load(): void {
    this.loading.set(true);
    forkJoin({
      customers: this.customersApi.list({ status: 'ACTIVE', page: 1, pageSize: 100 }),
      products: this.productsApi.list({ status: 'ACTIVE', page: 1, pageSize: 100 }),
      locations: this.inventoryApi.listLocations(),
      reservations: this.api.list(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ customers, products, locations, reservations }) => {
          this.customers.set(customers.data);
          this.products.set(products.data);
          this.locations.set(locations.data);
          this.reservations.set(reservations.data);
          if (!this.form.controls.locationId.value)
            this.form.controls.locationId.setValue(locations.data[0]?.id ?? '');
        },
        error: () => this.error.set('No fue posible cargar clientes, productos y ubicaciones.'),
      });
  }

  private loadReservations(): void {
    this.api.list().subscribe({
      next: ({ data }) => this.reservations.set(data),
      error: () => this.error.set('La reserva se creó, pero no se pudo recargar el historial.'),
    });
  }

  private resetForm(): void {
    this.form.reset({
      customerId: '',
      locationId: this.locations()[0]?.id ?? '',
      expiresInHours: 24,
    });
    this.lines.clear();
    this.lines.push(this.lineGroup());
  }
}
