import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  inject,
  input,
  OnChanges,
  OnInit,
  output,
  signal,
  SimpleChanges,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { SessionApiService } from '../auth/session-api.service';
import {
  InventoryApiService,
  InventoryLocationData,
  InventoryStockAlertData,
  InventoryStockAlertStatus,
  InventoryStockItem,
} from './inventory-api.service';

const QUANTITY_PATTERN = /^(0|[1-9]\d{0,11})(\.\d{1,3})?$/;

@Component({
  selector: 'app-stock-alert-panel',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './stock-alert-panel.component.html',
  styleUrl: './stock-alert-panel.component.scss',
})
export class StockAlertPanelComponent implements OnInit, OnChanges {
  private readonly inventory = inject(InventoryApiService);
  private readonly sessions = inject(SessionApiService);
  private readonly formBuilder = inject(FormBuilder);

  readonly products = input<InventoryStockItem[]>([]);
  readonly locations = input<InventoryLocationData[]>([]);
  readonly refreshToken = input(0);
  readonly viewStock = output<string>();

  protected readonly canConfigure = computed(
    () => this.sessions.session()?.user.permissions.includes('INVENTORY_ADJUST') ?? false,
  );
  protected readonly alerts = signal<InventoryStockAlertData[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(0);
  protected readonly total = signal(0);
  protected readonly defaultThreshold = signal('5.000');
  protected readonly filterForm = this.formBuilder.nonNullable.group({
    q: ['', [Validators.maxLength(80)]],
    status: ['' as '' | InventoryStockAlertStatus],
  });
  protected readonly thresholdForm = this.formBuilder.nonNullable.group({
    productId: ['', Validators.required],
    locationId: ['', Validators.required],
    threshold: ['5', [Validators.required, Validators.pattern(QUANTITY_PATTERN)]],
  });

  ngOnInit(): void {
    this.load(1);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['refreshToken'] && !changes['refreshToken'].firstChange) this.load(1);
  }

  protected filter(): void {
    if (this.filterForm.invalid) return this.filterForm.markAllAsTouched();
    this.load(1);
  }

  protected previous(): void {
    if (this.page() > 1) this.load(this.page() - 1);
  }

  protected next(): void {
    if (this.page() < this.totalPages()) this.load(this.page() + 1);
  }

  protected saveThreshold(): void {
    if (!this.canConfigure() || this.thresholdForm.invalid || this.saving()) {
      this.thresholdForm.markAllAsTouched();
      return;
    }
    const value = this.thresholdForm.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.inventory
      .setStockAlertThreshold(value.productId, value.locationId, value.threshold)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.success.set(
            `Umbral ${data.threshold} guardado para ${data.product.name} en ${data.location.name}.`,
          );
          this.load(1);
        },
        error: (error: HttpErrorResponse) => this.error.set(this.messageFor(error)),
      });
  }

  protected statusLabel(status: InventoryStockAlertStatus): string {
    return {
      LOW: 'Stock bajo',
      OUT_OF_STOCK: 'Agotado',
      RECOVERED: 'Recuperado',
    }[status];
  }

  private load(page: number): void {
    const value = this.filterForm.getRawValue();
    this.loading.set(true);
    this.error.set(null);
    this.inventory
      .listStockAlerts({
        ...(value.q.trim() ? { q: value.q.trim() } : {}),
        ...(value.status ? { status: value.status } : {}),
        page,
        pageSize: 10,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ data, meta }) => {
          this.alerts.set(data);
          this.defaultThreshold.set(meta.defaultThreshold);
          this.page.set(meta.pagination.page);
          this.totalPages.set(meta.pagination.totalPages);
          this.total.set(meta.pagination.total);
        },
        error: (error: HttpErrorResponse) => this.error.set(this.messageFor(error)),
      });
  }

  private messageFor(error: HttpErrorResponse): string {
    if (error.status === 403) return 'No tienes permiso para administrar alertas de inventario.';
    if (error.status === 0) return 'No fue posible conectar con el servicio de inventario.';
    return 'No fue posible actualizar las alertas de stock.';
  }
}
