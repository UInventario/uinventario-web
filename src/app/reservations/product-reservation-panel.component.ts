import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { ProductApiService, ProductData } from '../catalog/product-api.service';
import { CustomerApiService, CustomerData } from '../customers/customer-api.service';
import { InventoryApiService, InventoryLocationData } from '../inventory/inventory-api.service';
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
  private pending: { input: ProductReservationInput; key: string } | null = null;

  protected readonly customers = signal<CustomerData[]>([]);
  protected readonly products = signal<ProductData[]>([]);
  protected readonly locations = signal<InventoryLocationData[]>([]);
  protected readonly reservations = signal<ProductReservationData[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
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
