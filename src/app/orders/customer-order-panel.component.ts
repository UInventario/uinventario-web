import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { ProductApiService, ProductData } from '../catalog/product-api.service';
import { CustomerApiService, CustomerData } from '../customers/customer-api.service';
import { InventoryApiService, InventoryLocationData } from '../inventory/inventory-api.service';
import { CollectedPaymentMethod, PosApiService } from '../pos/pos-api.service';
import {
  CustomerOrderApiService,
  CustomerOrderData,
  CustomerOrderInput,
  CustomerOrderPriority,
  CustomerOrderStatus,
} from './customer-order-api.service';

const QUANTITY_PATTERN = /^(?:[1-9]\d*(?:\.\d{1,3})?|0\.(?:00[1-9]|0[1-9]\d?|[1-9]\d{0,2}))$/;
const MONEY_PATTERN = /^(0|[1-9]\d{0,11})(\.\d{1,2})?$/;
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{3,119}$/;

@Component({
  selector: 'app-customer-order-panel',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './customer-order-panel.component.html',
  styleUrl: './customer-order-panel.component.scss',
})
export class CustomerOrderPanelComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(CustomerOrderApiService);
  private readonly customersApi = inject(CustomerApiService);
  private readonly productsApi = inject(ProductApiService);
  private readonly inventoryApi = inject(InventoryApiService);
  private readonly posApi = inject(PosApiService);
  private pendingCreate: { signature: string; key: string } | null = null;
  private pendingAction: {
    orderId: string;
    action: 'confirm' | 'prepare' | 'ready' | 'dispatch' | 'deliver' | 'cancel';
    version: number;
    reason?: string;
    key: string;
  } | null = null;

  protected readonly customers = signal<CustomerData[]>([]);
  protected readonly products = signal<ProductData[]>([]);
  protected readonly locations = signal<InventoryLocationData[]>([]);
  protected readonly paymentMethods = signal<CollectedPaymentMethod[]>(['CASH']);
  protected readonly orders = signal<CustomerOrderData[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly actionId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly cancelling = signal<CustomerOrderData | null>(null);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(0);
  protected readonly total = signal(0);

  protected readonly filterForm = this.formBuilder.nonNullable.group({
    status: ['' as '' | CustomerOrderStatus],
    priority: ['' as '' | CustomerOrderPriority],
  });
  protected readonly form = this.formBuilder.nonNullable.group({
    customerId: ['', Validators.required],
    locationId: ['', Validators.required],
    channel: ['WEB' as CustomerOrderData['channel'], Validators.required],
    priority: ['NORMAL' as CustomerOrderPriority, Validators.required],
    expiresInHours: [48, [Validators.required, Validators.min(1), Validators.max(720)]],
    fulfillmentMethod: ['PICKUP' as 'PICKUP' | 'DELIVERY', Validators.required],
    windowStart: [this.localDateTime(1), Validators.required],
    windowEnd: [this.localDateTime(3), Validators.required],
    deliveryCost: ['0.00', [Validators.required, Validators.pattern(MONEY_PATTERN)]],
    recipientName: ['', [Validators.maxLength(120)]],
    recipientPhone: ['', [Validators.pattern(/^\+?[0-9 ()-]{7,40}$/)]],
    addressLine1: ['', [Validators.maxLength(180)]],
    addressLine2: ['', [Validators.maxLength(180)]],
    city: ['', [Validators.maxLength(100)]],
    region: ['', [Validators.maxLength(100)]],
    postalCode: ['', [Validators.pattern(/^[A-Za-z0-9 -]{3,24}$/)]],
    countryCode: ['MX', [Validators.pattern(/^[A-Z]{2}$/)]],
    carrierCode: ['SIMULATED' as 'SIMULATED' | 'SIMULATED_RETRY'],
    paymentMethod: ['CASH' as CollectedPaymentMethod, Validators.required],
    amountReceived: ['', [Validators.pattern(MONEY_PATTERN)]],
    reference: ['', [Validators.pattern(REFERENCE_PATTERN)]],
    lines: this.formBuilder.array([this.lineGroup()]),
  });
  protected readonly cancellationReason = this.formBuilder.nonNullable.control('', [
    Validators.required,
    Validators.minLength(3),
    Validators.maxLength(240),
  ]);

  protected get lines(): FormArray<ReturnType<CustomerOrderPanelComponent['lineGroup']>> {
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

  protected paymentChanged(): void {
    this.form.controls.amountReceived.setValue('');
    this.form.controls.reference.setValue('');
  }

  protected fulfillmentChanged(): void {
    if (this.form.controls.fulfillmentMethod.value === 'PICKUP') {
      this.form.patchValue({
        deliveryCost: '0.00',
        recipientName: '',
        recipientPhone: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        region: '',
        postalCode: '',
        countryCode: 'MX',
        carrierCode: 'SIMULATED',
      });
    }
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    if (new Set(raw.lines.map(({ productId }) => productId)).size !== raw.lines.length) {
      this.error.set('Cada producto debe aparecer una sola vez en el pedido.');
      return;
    }
    if (raw.paymentMethod === 'CASH' && !raw.amountReceived.trim()) {
      this.error.set('Indica el efectivo que se recibirá al entregar.');
      return;
    }
    if (raw.paymentMethod !== 'CASH' && !raw.reference.trim()) {
      this.error.set('Indica la referencia que se autorizará al entregar.');
      return;
    }
    const windowStart = new Date(raw.windowStart);
    const windowEnd = new Date(raw.windowEnd);
    if (
      Number.isNaN(windowStart.getTime()) ||
      Number.isNaN(windowEnd.getTime()) ||
      windowEnd <= windowStart
    ) {
      this.error.set('La ventana de entrega debe terminar después de iniciar.');
      return;
    }
    if (
      raw.fulfillmentMethod === 'DELIVERY' &&
      [
        raw.recipientName,
        raw.recipientPhone,
        raw.addressLine1,
        raw.city,
        raw.region,
        raw.postalCode,
        raw.countryCode,
      ].some((value) => !value.trim())
    ) {
      this.error.set('Completa los datos mínimos del despacho.');
      return;
    }
    const input: CustomerOrderInput = {
      channel: raw.channel,
      customerId: raw.customerId,
      locationId: raw.locationId,
      priority: raw.priority,
      expiresInHours: raw.expiresInHours,
      fulfillment:
        raw.fulfillmentMethod === 'PICKUP'
          ? {
              method: 'PICKUP',
              deliveryCost: '0.00',
              windowStart: windowStart.toISOString(),
              windowEnd: windowEnd.toISOString(),
            }
          : {
              method: 'DELIVERY',
              deliveryCost: raw.deliveryCost.trim(),
              windowStart: windowStart.toISOString(),
              windowEnd: windowEnd.toISOString(),
              recipientName: raw.recipientName.trim(),
              recipientPhone: raw.recipientPhone.trim(),
              addressLine1: raw.addressLine1.trim(),
              ...(raw.addressLine2.trim() ? { addressLine2: raw.addressLine2.trim() } : {}),
              city: raw.city.trim(),
              region: raw.region.trim(),
              postalCode: raw.postalCode.trim(),
              countryCode: raw.countryCode.trim(),
              carrierCode: raw.carrierCode,
            },
      lines: raw.lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity.trim(),
        ...(line.serialNumbers.trim()
          ? {
              serialNumbers: line.serialNumbers
                .split(/\r?\n/)
                .map((value) => value.trim())
                .filter(Boolean),
            }
          : {}),
      })),
      payments: [
        raw.paymentMethod === 'CASH'
          ? { method: raw.paymentMethod, amountReceived: raw.amountReceived.trim() }
          : { method: raw.paymentMethod, reference: raw.reference.trim() },
      ],
    };
    const signature = JSON.stringify(input);
    const pending = this.pendingCreate;
    const request =
      pending?.signature === signature
        ? pending
        : { signature, key: `web-order-create-${crypto.randomUUID()}` };
    this.pendingCreate = request;
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api
      .create(input, request.key)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.pendingCreate = null;
          this.success.set(
            `Pedido ${data.orderNumber} creado por ${data.totals.total} ${data.currency}.`,
          );
          this.resetForm();
          this.loadOrders(1);
        },
        error: (error: HttpErrorResponse) => {
          if (error.status > 0 && error.status < 500) this.pendingCreate = null;
          this.error.set(this.message(error));
        },
      });
  }

  protected transition(
    order: CustomerOrderData,
    action: 'confirm' | 'prepare' | 'ready' | 'dispatch' | 'deliver',
  ): void {
    this.runAction(order, action);
  }

  protected requestCancellation(order: CustomerOrderData): void {
    this.cancelling.set(order);
    this.cancellationReason.setValue('');
  }

  protected dismissCancellation(): void {
    this.cancelling.set(null);
    this.cancellationReason.setValue('');
  }

  protected confirmCancellation(): void {
    const order = this.cancelling();
    if (!order || this.cancellationReason.invalid) {
      this.cancellationReason.markAsTouched();
      return;
    }
    this.runAction(order, 'cancel', this.cancellationReason.value.trim());
  }

  protected filter(): void {
    this.loadOrders(1);
  }

  protected previousPage(): void {
    if (this.page() > 1) this.loadOrders(this.page() - 1);
  }

  protected nextPage(): void {
    if (this.page() < this.totalPages()) this.loadOrders(this.page() + 1);
  }

  protected statusLabel(status: CustomerOrderStatus): string {
    return {
      DRAFT: 'Borrador',
      CONFIRMED: 'Confirmado',
      PREPARING: 'En preparación',
      READY: 'Listo',
      DELIVERED: 'Entregado',
      CANCELLED: 'Cancelado',
    }[status];
  }

  protected priorityLabel(priority: CustomerOrderPriority): string {
    return { LOW: 'Baja', NORMAL: 'Normal', HIGH: 'Alta', URGENT: 'Urgente' }[priority];
  }

  protected fulfillmentStatusLabel(status: CustomerOrderData['fulfillment']['status']): string {
    return {
      PENDING: 'Pendiente',
      PREPARING: 'En preparación',
      READY: 'Listo para entregar',
      RETRYABLE_FAILURE: 'Despacho reintentable',
      DISPATCHED: 'En tránsito',
      DELIVERED: 'Entregado',
      CANCELLED: 'Cancelado',
    }[status];
  }

  private runAction(
    order: CustomerOrderData,
    action: 'confirm' | 'prepare' | 'ready' | 'dispatch' | 'deliver' | 'cancel',
    reason?: string,
  ): void {
    if (this.actionId()) return;
    const pending = this.pendingAction;
    const request =
      pending?.orderId === order.id &&
      pending.action === action &&
      pending.version === order.version &&
      pending.reason === reason
        ? pending
        : {
            orderId: order.id,
            action,
            version: order.version,
            reason,
            key: `web-order-${action}-${crypto.randomUUID()}`,
          };
    this.pendingAction = request;
    this.actionId.set(order.id);
    this.error.set(null);
    this.success.set(null);
    this.api
      .transition(order.id, action, order.version, request.key, reason)
      .pipe(finalize(() => this.actionId.set(null)))
      .subscribe({
        next: ({ data }) => {
          this.pendingAction = null;
          this.cancelling.set(null);
          this.success.set(
            action === 'dispatch'
              ? `Pedido ${data.orderNumber}: ${this.fulfillmentStatusLabel(data.fulfillment.status).toLowerCase()}.`
              : `Pedido ${data.orderNumber}: ${this.statusLabel(data.status).toLowerCase()}.`,
          );
          this.loadOrders(this.page());
        },
        error: (error: HttpErrorResponse) => {
          if (error.status > 0 && error.status < 500) this.pendingAction = null;
          this.error.set(this.message(error));
          if (error.status === 409) this.loadOrders(this.page());
        },
      });
  }

  private load(): void {
    this.loading.set(true);
    forkJoin({
      customers: this.customersApi.list({ status: 'ACTIVE', page: 1, pageSize: 100 }),
      products: this.productsApi.list({ status: 'ACTIVE', page: 1, pageSize: 100 }),
      locations: this.inventoryApi.listLocations(),
      paymentOptions: this.posApi.getPaymentOptions(),
      orders: this.api.list({ page: 1, pageSize: 20 }),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ customers, products, locations, paymentOptions, orders }) => {
          this.customers.set(customers.data);
          this.products.set(products.data);
          this.locations.set(locations.data);
          this.paymentMethods.set(paymentOptions.data.methods);
          this.orders.set(orders.data);
          this.page.set(orders.meta.pagination.page);
          this.totalPages.set(orders.meta.pagination.totalPages);
          this.total.set(orders.meta.pagination.total);
          if (!this.form.controls.locationId.value)
            this.form.controls.locationId.setValue(locations.data[0]?.id ?? '');
          if (!paymentOptions.data.methods.includes(this.form.controls.paymentMethod.value))
            this.form.controls.paymentMethod.setValue(paymentOptions.data.methods[0] ?? 'CASH');
        },
        error: () => this.error.set('No fue posible cargar la bandeja de pedidos.'),
      });
  }

  private loadOrders(page: number): void {
    this.loading.set(true);
    const filter = this.filterForm.getRawValue();
    this.api
      .list({
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.priority ? { priority: filter.priority } : {}),
        page,
        pageSize: 20,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ data, meta }) => {
          this.orders.set(data);
          this.page.set(meta.pagination.page);
          this.totalPages.set(meta.pagination.totalPages);
          this.total.set(meta.pagination.total);
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  private lineGroup() {
    return this.formBuilder.nonNullable.group({
      productId: ['', Validators.required],
      quantity: ['1', [Validators.required, Validators.pattern(QUANTITY_PATTERN)]],
      serialNumbers: [''],
    });
  }

  private resetForm(): void {
    this.form.reset({
      customerId: '',
      locationId: this.locations()[0]?.id ?? '',
      channel: 'WEB',
      priority: 'NORMAL',
      expiresInHours: 48,
      fulfillmentMethod: 'PICKUP',
      windowStart: this.localDateTime(1),
      windowEnd: this.localDateTime(3),
      deliveryCost: '0.00',
      recipientName: '',
      recipientPhone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      region: '',
      postalCode: '',
      countryCode: 'MX',
      carrierCode: 'SIMULATED',
      paymentMethod: this.paymentMethods()[0] ?? 'CASH',
      amountReceived: '',
      reference: '',
    });
    this.lines.clear();
    this.lines.push(this.lineGroup());
  }

  private message(error: HttpErrorResponse): string {
    if (typeof error.error?.message === 'string') return error.error.message;
    if (error.status === 0) return 'No fue posible conectar con el servicio de pedidos.';
    return 'No fue posible completar la operación del pedido.';
  }

  private localDateTime(offsetHours: number): string {
    const value = new Date(Date.now() + offsetHours * 60 * 60_000);
    value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
    return value.toISOString().slice(0, 16);
  }
}
