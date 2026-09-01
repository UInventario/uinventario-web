import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { AuthorizationService } from '../../../../../core/authorization/authorization.service';
import { InventoryOperationsFacade } from '../../application/inventory-operations.facade';
import {
  AlertPage,
  AlertQuery,
  AlertStatus,
  StockAlert,
} from '../../domain/inventory-operations.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  selector: 'ui-stock-alert-panel',
  styleUrls: ['./alert-panel.scss', './alert-panel-responsive.scss'],
  templateUrl: './alert-panel.html',
})
export class AlertPanel implements OnInit {
  private readonly authorization = inject(AuthorizationService);
  private readonly facade = inject(InventoryOperationsFacade);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly canAdjust = computed(() => this.authorization.has('INVENTORY_ADJUST'));
  protected readonly loading = signal(true);
  protected readonly savingKey = signal<string | null>(null);
  protected readonly page = signal<AlertPage | null>(null);
  protected readonly thresholds = signal<Record<string, string>>({});
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly filters = this.formBuilder.nonNullable.group({ q: '', status: '' });
  protected readonly statuses: readonly { value: AlertStatus | ''; label: string }[] = [
    { value: '', label: 'Todas' },
    { value: 'OUT_OF_STOCK', label: 'Sin stock' },
    { value: 'LOW', label: 'Stock bajo' },
    { value: 'RECOVERED', label: 'Recuperadas' },
  ];

  ngOnInit(): void {
    this.load(1);
  }

  protected apply(): void {
    this.load(1);
  }

  protected goTo(page: number): void {
    this.load(page);
  }

  protected updateThreshold(alert: StockAlert, value: string): void {
    this.thresholds.update((current) => ({ ...current, [this.key(alert)]: value }));
  }

  protected saveThreshold(alert: StockAlert): void {
    const key = this.key(alert);
    const value = this.thresholds()[key]?.trim();
    if (!value || this.savingKey()) return;
    this.clearMessages();
    this.savingKey.set(key);
    this.facade
      .setThreshold(alert, value)
      .pipe(finalize(() => this.savingKey.set(null)))
      .subscribe({
        next: (updated) => {
          this.notice.set('Umbral actualizado; el estado refleja el saldo real actual.');
          this.page.update((page) =>
            page
              ? {
                  ...page,
                  items: page.items.map((item) => (this.key(item) === key ? updated : item)),
                }
              : page,
          );
          this.thresholds.update((current) => ({ ...current, [key]: updated.threshold }));
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  protected statusLabel(status: AlertStatus): string {
    return { LOW: 'Stock bajo', OUT_OF_STOCK: 'Sin stock', RECOVERED: 'Recuperada' }[status];
  }

  protected key(alert: StockAlert): string {
    return `${alert.product.id}:${alert.location.id}`;
  }

  private load(page: number): void {
    this.clearMessages();
    this.loading.set(true);
    const filters = this.filters.getRawValue();
    const query: AlertQuery = {
      q: filters.q.trim() || undefined,
      status: (filters.status as AlertStatus) || undefined,
      page,
      pageSize: 20,
    };
    this.facade
      .alerts(query)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          this.page.set(result);
          this.thresholds.set(
            Object.fromEntries(result.items.map((alert) => [this.key(alert), alert.threshold])),
          );
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  private clearMessages(): void {
    this.error.set(null);
    this.notice.set(null);
  }

  private message(error: unknown): string {
    return error instanceof ApiError ? error.message : 'No fue posible consultar las alertas.';
  }
}
