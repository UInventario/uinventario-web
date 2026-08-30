import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import type { SessionData } from '../auth/session-api.service';
import type { CustomerData } from '../customers/customer-api.service';
import {
  CommerceApiService,
  CommerceCredentialData,
  CommerceScope,
  CommerceWebhookDeliveryData,
  CommerceWebhookEvent,
} from './commerce-api.service';

@Component({
  selector: 'app-commerce-integration-panel',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './commerce-integration-panel.component.html',
  styleUrl: './commerce-integration-panel.component.scss',
})
export class CommerceIntegrationPanelComponent implements OnInit {
  private readonly api = inject(CommerceApiService);
  private readonly formBuilder = inject(FormBuilder);

  readonly session = input.required<SessionData>();
  readonly locations = input.required<Array<{ id: string; name: string; code: string }>>();
  readonly customers = input.required<CustomerData[]>();

  protected readonly credentials = signal<CommerceCredentialData[]>([]);
  protected readonly deliveries = signal<CommerceWebhookDeliveryData[]>([]);
  protected readonly apiKey = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly scopes: CommerceScope[] = [
    'CATALOG_READ',
    'STOCK_READ',
    'ORDERS_WRITE',
    'ORDERS_READ',
  ];
  protected readonly events: CommerceWebhookEvent[] = [
    'ORDER_CONFIRMED',
    'ORDER_PREPARING',
    'ORDER_READY',
    'ORDER_DELIVERED',
    'ORDER_CANCELLED',
    'ORDER_FULFILLMENT_UPDATED',
  ];

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80)]],
    customerId: ['', Validators.required],
    locationId: ['', Validators.required],
    rateLimitPerMinute: [60, [Validators.required, Validators.min(10), Validators.max(600)]],
    webhookEnabled: [false],
    webhookUrl: [''],
    scopes: this.formBuilder.nonNullable.control<CommerceScope[]>([...this.scopes]),
    webhookEvents: this.formBuilder.nonNullable.control<CommerceWebhookEvent[]>([...this.events]),
  });

  constructor() {
    effect(() => {
      const firstCustomer = this.customers().find(({ active }) => active);
      const firstLocation = this.locations()[0];
      if (!this.form.controls.customerId.value && firstCustomer)
        this.form.controls.customerId.setValue(firstCustomer.id);
      if (!this.form.controls.locationId.value && firstLocation)
        this.form.controls.locationId.setValue(firstLocation.id);
    });
  }

  ngOnInit(): void {
    this.load();
  }

  protected toggleScope(scope: CommerceScope, checked: boolean): void {
    const current = this.form.controls.scopes.value;
    this.form.controls.scopes.setValue(
      checked ? [...new Set([...current, scope])] : current.filter((item) => item !== scope),
    );
  }

  protected toggleEvent(event: CommerceWebhookEvent, checked: boolean): void {
    const current = this.form.controls.webhookEvents.value;
    this.form.controls.webhookEvents.setValue(
      checked ? [...new Set([...current, event])] : current.filter((item) => item !== event),
    );
  }

  protected submit(): void {
    this.clearMessages();
    const context = this.session().context;
    if (this.form.invalid || this.form.controls.scopes.value.length === 0) {
      this.form.markAllAsTouched();
      this.error.set('Completa el nombre, contexto y al menos un alcance.');
      return;
    }
    if (!context.branch || !context.warehouse || !context.cashRegister) {
      this.error.set('Selecciona una sucursal, bodega y caja activa antes de emitir la clave.');
      return;
    }
    const value = this.form.getRawValue();
    if (value.webhookEnabled && !value.webhookUrl) {
      this.error.set('Indica una URL HTTPS para activar webhooks.');
      return;
    }
    this.saving.set(true);
    this.api
      .create({
        ...value,
        branchId: context.branch.id,
        warehouseId: context.warehouse.id,
        cashRegisterId: context.cashRegister.id,
        webhookUrl: value.webhookUrl || undefined,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.apiKey.set(data.apiKey);
          this.credentials.update((items) => [data, ...items]);
          this.form.controls.name.reset('');
          this.success.set('Credencial emitida. Copia la clave ahora; no volverá a mostrarse.');
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  protected revoke(credential: CommerceCredentialData): void {
    if (!credential.active || this.saving()) return;
    this.clearMessages();
    this.saving.set(true);
    this.api
      .revoke(credential.id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.credentials.update((items) =>
            items.map((item) => (item.id === credential.id ? { ...item, active: false } : item)),
          );
          this.success.set('Credencial revocada de inmediato.');
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  protected dismissKey(): void {
    this.apiKey.set(null);
  }

  private load(): void {
    forkJoin({ credentials: this.api.credentials(), deliveries: this.api.deliveries() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ credentials, deliveries }) => {
          this.credentials.set(credentials.data);
          this.deliveries.set(deliveries.data);
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  private clearMessages(): void {
    this.error.set(null);
    this.success.set(null);
  }

  private message(error: HttpErrorResponse): string {
    if (error.status === 403) return 'No tienes permiso para administrar esta integración.';
    if (error.status === 409) return 'Ya existe una credencial con ese nombre.';
    if (error.status === 0) return 'No fue posible conectar con la API.';
    return 'No fue posible completar la operación.';
  }
}
