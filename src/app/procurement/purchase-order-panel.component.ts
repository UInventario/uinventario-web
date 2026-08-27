import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { SupplierApiService, SupplierData } from '../suppliers/supplier-api.service';
import {
  SupplierProductApiService,
  SupplierProductData,
} from '../suppliers/supplier-product-api.service';
import {
  PurchaseOrderApiService,
  PurchaseOrderData,
  PurchaseOrderInput,
} from './purchase-order-api.service';

const QUANTITY_PATTERN = /^(?:[1-9]\d*(?:\.\d{1,3})?|0\.(?:00[1-9]|0[1-9]\d?|[1-9]\d{0,2}))$/;
const COST_PATTERN = /^(?:[1-9]\d*(?:\.\d{1,2})?|0\.(?:0[1-9]|[1-9]\d?))$/;

@Component({
  selector: 'app-purchase-order-panel',
  imports: [ReactiveFormsModule],
  templateUrl: './purchase-order-panel.component.html',
  styleUrl: './purchase-order-panel.component.scss',
})
export class PurchaseOrderPanelComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly ordersApi = inject(PurchaseOrderApiService);
  private readonly suppliersApi = inject(SupplierApiService);
  private readonly supplierProductsApi = inject(SupplierProductApiService);
  private pendingTransition: {
    orderId: string;
    action: 'approve' | 'send' | 'cancel';
    version: number;
    reason?: string;
    key: string;
  } | null = null;

  readonly canApprove = input(false);
  readonly canManage = input(true);

  protected readonly suppliers = signal<SupplierData[]>([]);
  protected readonly supplierProducts = signal<SupplierProductData[]>([]);
  protected readonly orders = signal<PurchaseOrderData[]>([]);
  protected readonly editing = signal<PurchaseOrderData | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly transitioningId = signal<string | null>(null);
  protected readonly cancelling = signal<PurchaseOrderData | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(0);
  protected readonly total = signal(0);
  protected readonly searchForm = this.formBuilder.nonNullable.group({
    q: ['', [Validators.maxLength(100)]],
  });
  protected readonly cancelForm = this.formBuilder.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(500)]],
  });
  protected readonly form = this.formBuilder.nonNullable.group({
    supplierId: ['', [Validators.required]],
    currency: ['MXN', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
    notes: ['', [Validators.maxLength(1000)]],
    lines: this.formBuilder.array([this.lineGroup()]),
  });

  protected get lines(): FormArray<ReturnType<PurchaseOrderPanelComponent['lineGroup']>> {
    return this.form.controls.lines;
  }

  ngOnInit(): void {
    if (this.canManage()) this.loadOptions();
    this.load(1);
  }

  protected availableProducts(): SupplierProductData[] {
    const supplierId = this.form.controls.supplierId.value;
    return this.supplierProducts().filter((link) => link.supplier.id === supplierId);
  }

  protected supplierChanged(): void {
    this.lines.clear();
    this.lines.push(this.lineGroup());
  }

  protected addLine(): void {
    if (this.lines.length < 100) this.lines.push(this.lineGroup());
  }

  protected removeLine(index: number): void {
    if (this.lines.length > 1) this.lines.removeAt(index);
  }

  protected productChanged(index: number): void {
    const line = this.lines.at(index);
    const link = this.supplierProducts().find(
      (candidate) => candidate.id === line.controls.supplierProductId.value,
    );
    if (!link?.prices[0]) return;
    line.controls.unitCost.setValue(link.prices[0].unitCost);
    if (this.lines.length === 1 || !this.form.controls.currency.dirty) {
      this.form.controls.currency.setValue(link.prices[0].currency);
    }
  }

  protected filter(): void {
    this.load(1);
  }

  protected previousPage(): void {
    if (this.page() > 1) this.load(this.page() - 1);
  }

  protected nextPage(): void {
    if (this.page() < this.totalPages()) this.load(this.page() + 1);
  }

  protected edit(order: PurchaseOrderData): void {
    if (!this.canManage() || order.status !== 'DRAFT') return;
    this.editing.set(order);
    this.form.patchValue({
      supplierId: order.supplier.id,
      currency: order.currency,
      notes: order.notes ?? '',
    });
    this.lines.clear();
    for (const line of order.lines) {
      this.lines.push(
        this.lineGroup({
          supplierProductId: line.supplierProductId,
          quantity: line.quantity,
          unitCost: line.unitCost,
          notes: line.notes ?? '',
        }),
      );
    }
    this.error.set(null);
    this.success.set(null);
  }

  protected cancelEditing(): void {
    this.editing.set(null);
    this.resetForm();
  }

  protected approve(order: PurchaseOrderData): void {
    if (!this.canApprove() || order.status !== 'DRAFT') return;
    this.transition(order, 'approve');
  }

  protected send(order: PurchaseOrderData): void {
    if (!this.canManage() || order.status !== 'APPROVED') return;
    this.transition(order, 'send');
  }

  protected requestCancellation(order: PurchaseOrderData): void {
    if (!this.canApprove() || !['DRAFT', 'APPROVED', 'SENT'].includes(order.status)) return;
    this.cancelling.set(order);
    this.cancelForm.reset({ reason: '' });
    this.error.set(null);
  }

  protected dismissCancellation(): void {
    this.cancelling.set(null);
    this.cancelForm.reset({ reason: '' });
  }

  protected confirmCancellation(): void {
    const order = this.cancelling();
    if (!order || this.cancelForm.invalid) {
      this.cancelForm.markAllAsTouched();
      return;
    }
    this.transition(order, 'cancel', this.cancelForm.controls.reason.value.trim());
  }

  protected statusLabel(status: PurchaseOrderData['status']): string {
    return {
      DRAFT: 'Borrador',
      APPROVED: 'Aprobada',
      SENT: 'Enviada',
      PARTIALLY_RECEIVED: 'Recibida parcialmente',
      RECEIVED: 'Recibida',
      CANCELLED: 'Cancelada',
    }[status];
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    if (new Set(raw.lines.map((line) => line.supplierProductId)).size !== raw.lines.length) {
      this.error.set('Cada producto del proveedor sólo puede aparecer una vez.');
      return;
    }
    const input: PurchaseOrderInput = {
      supplierId: raw.supplierId,
      currency: raw.currency.trim().toUpperCase(),
      ...(raw.notes.trim() ? { notes: raw.notes.trim() } : {}),
      lines: raw.lines.map((line) => ({
        supplierProductId: line.supplierProductId,
        quantity: line.quantity.trim(),
        unitCost: line.unitCost.trim(),
        ...(line.notes.trim() ? { notes: line.notes.trim() } : {}),
      })),
    };
    const current = this.editing();
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    const operation = current
      ? this.ordersApi.update(current.id, { ...input, version: current.version })
      : this.ordersApi.create(input);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: ({ data }) => {
        this.success.set(
          current ? `Orden ${data.folio} actualizada.` : `Borrador ${data.folio} creado.`,
        );
        this.editing.set(null);
        this.resetForm();
        this.load(1);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(this.message(error));
        if (error.error?.code === 'PURCHASE_ORDER_VERSION_CONFLICT') this.load(this.page());
      },
    });
  }

  private loadOptions(): void {
    this.suppliersApi.list({ status: 'ACTIVE', page: 1, pageSize: 100 }).subscribe({
      next: ({ data }) => this.suppliers.set(data),
      error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
    });
    this.supplierProductsApi.list({ page: 1, pageSize: 100 }).subscribe({
      next: ({ data }) => this.supplierProducts.set(data),
      error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
    });
  }

  private transition(
    order: PurchaseOrderData,
    action: 'approve' | 'send' | 'cancel',
    reason?: string,
  ): void {
    if (this.transitioningId()) return;
    const pending = this.pendingTransition;
    const request =
      pending &&
      pending.orderId === order.id &&
      pending.action === action &&
      pending.version === order.version &&
      pending.reason === reason
        ? pending
        : {
            orderId: order.id,
            action,
            version: order.version,
            reason,
            key: `web-purchase-${action}-${globalThis.crypto.randomUUID()}`,
          };
    this.pendingTransition = request;
    this.transitioningId.set(order.id);
    this.error.set(null);
    this.success.set(null);
    const operation =
      action === 'approve'
        ? this.ordersApi.approve(order.id, { version: order.version }, request.key)
        : action === 'send'
          ? this.ordersApi.send(order.id, order.version, request.key)
          : this.ordersApi.cancel(
              order.id,
              { version: order.version, reason: reason! },
              request.key,
            );
    operation.pipe(finalize(() => this.transitioningId.set(null))).subscribe({
      next: ({ data }) => {
        this.pendingTransition = null;
        this.cancelling.set(null);
        this.success.set(
          action === 'approve'
            ? `Orden ${data.folio} aprobada y disponible para recepción.`
            : action === 'send'
              ? `Envío simulado para la orden ${data.folio}.`
              : `Orden ${data.folio} cancelada.`,
        );
        this.load(1);
      },
      error: (error: HttpErrorResponse) => {
        if (error.status > 0 && error.status < 500) this.pendingTransition = null;
        this.error.set(this.message(error));
      },
    });
  }

  private load(page: number): void {
    this.loading.set(true);
    const query = this.searchForm.controls.q.value.trim();
    this.ordersApi
      .list({ ...(query ? { q: query } : {}), page, pageSize: 10 })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ data, meta }) => {
          this.orders.set(data);
          this.page.set(meta.pagination.page);
          this.totalPages.set(meta.pagination.totalPages);
          this.total.set(meta.pagination.total);
        },
        error: (error: HttpErrorResponse) => {
          this.orders.set([]);
          this.error.set(this.message(error));
        },
      });
  }

  private lineGroup(value?: {
    supplierProductId?: string;
    quantity?: string;
    unitCost?: string;
    notes?: string;
  }) {
    return this.formBuilder.nonNullable.group({
      supplierProductId: [value?.supplierProductId ?? '', [Validators.required]],
      quantity: [
        value?.quantity ?? '1.000',
        [Validators.required, Validators.pattern(QUANTITY_PATTERN)],
      ],
      unitCost: [value?.unitCost ?? '', [Validators.required, Validators.pattern(COST_PATTERN)]],
      notes: [value?.notes ?? '', [Validators.maxLength(500)]],
    });
  }

  private resetForm(): void {
    this.form.reset({ supplierId: '', currency: 'MXN', notes: '' });
    this.lines.clear();
    this.lines.push(this.lineGroup());
  }

  private message(error: HttpErrorResponse): string {
    if (typeof error.error?.message === 'string') return error.error.message;
    if (error.status === 0) return 'No fue posible conectar con el servicio de compras.';
    return 'No fue posible guardar la orden de compra.';
  }
}
