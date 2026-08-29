import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { SessionApiService } from '../auth/session-api.service';
import { InventoryApiService } from '../inventory/inventory-api.service';
import { OfflineFreshnessState, OfflineStoreService } from '../offline/offline-store.service';
import {
  PosApiService,
  PosProfitabilityReportData,
  SalesCashReportData,
} from '../pos/pos-api.service';
import { PurchaseOrderApiService } from '../procurement/purchase-order-api.service';

type DashboardWidget = 'sales' | 'margin' | 'stock' | 'purchases' | 'sync';

interface SyncSummary {
  entities: number;
  pending: number;
  conflicts: number;
  generatedAt: string | null;
  freshness: OfflineFreshnessState['condition'];
}

interface DashboardPreferences extends Partial<Record<DashboardWidget, unknown>> {
  period?: { dateFrom?: unknown; dateTo?: unknown };
}

@Component({
  selector: 'app-operational-dashboard',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './operational-dashboard.component.html',
  styleUrl: './operational-dashboard.component.scss',
})
export class OperationalDashboardComponent implements OnInit {
  private readonly sessions = inject(SessionApiService);
  private readonly pos = inject(PosApiService);
  private readonly inventory = inject(InventoryApiService);
  private readonly purchases = inject(PurchaseOrderApiService);
  private readonly offline = inject(OfflineStoreService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly session = this.sessions.session;
  protected readonly canViewSales = computed(
    () =>
      Boolean(this.session()?.context.cashRegister) &&
      (this.session()?.user.permissions.includes('SALES_MANAGE') ?? false),
  );
  protected readonly canViewMargin = computed(
    () =>
      this.canViewSales() &&
      (this.session()?.user.permissions.includes('INVENTORY_VALUATION_MANAGE') ?? false),
  );
  protected readonly canViewStock = computed(
    () => this.session()?.user.permissions.includes('INVENTORY_VIEW') ?? false,
  );
  protected readonly canViewPurchases = computed(() => {
    const permissions = this.session()?.user.permissions ?? [];
    return (
      permissions.includes('PURCHASE_ORDERS_MANAGE') ||
      permissions.includes('PURCHASE_ORDERS_APPROVE')
    );
  });

  protected readonly periodForm = this.formBuilder.nonNullable.group({
    dateFrom: [this.today()],
    dateTo: [this.today()],
  });
  protected readonly configured = signal<Record<DashboardWidget, boolean>>({
    sales: true,
    margin: true,
    stock: true,
    purchases: true,
    sync: true,
  });
  protected readonly periodError = signal<string | null>(null);
  protected readonly sales = signal<SalesCashReportData | null>(null);
  protected readonly periodTimezones = computed(() => {
    const timezones = [...new Set(this.sales()?.scope.map(({ timezone }) => timezone) ?? [])];
    return timezones.join(', ') || 'No disponible';
  });
  protected readonly salesLoading = signal(false);
  protected readonly salesError = signal<string | null>(null);
  protected readonly salesUpdatedAt = signal<string | null>(null);
  protected readonly profitability = signal<PosProfitabilityReportData | null>(null);
  protected readonly marginLoading = signal(false);
  protected readonly marginError = signal<string | null>(null);
  protected readonly marginUpdatedAt = signal<string | null>(null);
  protected readonly stockAlerts = signal({ low: 0, outOfStock: 0 });
  protected readonly stockLoading = signal(false);
  protected readonly stockError = signal<string | null>(null);
  protected readonly stockUpdatedAt = signal<string | null>(null);
  protected readonly purchaseTotal = signal(0);
  protected readonly purchaseLoading = signal(false);
  protected readonly purchaseError = signal<string | null>(null);
  protected readonly purchaseUpdatedAt = signal<string | null>(null);
  protected readonly sync = signal<SyncSummary | null>(null);
  protected readonly syncLoading = signal(false);
  protected readonly syncError = signal<string | null>(null);
  protected readonly syncUpdatedAt = signal<string | null>(null);

  ngOnInit(): void {
    this.restoreConfiguration();
    this.refresh();
  }

  protected refresh(): void {
    const { dateFrom, dateTo } = this.periodForm.getRawValue();
    if (dateFrom && dateTo && dateFrom > dateTo) {
      this.periodError.set('La fecha inicial no puede ser posterior a la fecha final.');
      return;
    }
    this.periodError.set(null);
    this.persistConfiguration();
    if (this.canViewSales() && this.widgetEnabled('sales')) this.loadSales();
    if (this.canViewMargin() && this.widgetEnabled('margin')) this.loadMargin();
    if (this.canViewStock() && this.widgetEnabled('stock')) this.loadStock();
    if (this.canViewPurchases() && this.widgetEnabled('purchases')) this.loadPurchases();
    if (this.widgetEnabled('sync')) void this.loadSync();
  }

  protected widgetEnabled(widget: DashboardWidget): boolean {
    return this.configured()[widget];
  }

  protected toggleWidget(widget: DashboardWidget, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.configured.update((current) => ({ ...current, [widget]: checked }));
    this.persistConfiguration();
    if (checked) this.refresh();
  }

  protected freshnessLabel(condition: SyncSummary['freshness']): string {
    return (
      {
        FRESH: 'Vigente',
        CATALOG_STALE: 'Catálogo vencido',
        PERMISSIONS_STALE: 'Permisos vencidos',
        SESSION_EXPIRED: 'Sesión vencida',
        NOT_PREPARED: 'Sin preparar',
        CLOCK_INVALID: 'Reloj inválido',
      } satisfies Record<SyncSummary['freshness'], string>
    )[condition];
  }

  protected salesEmpty(report: SalesCashReportData): boolean {
    return report.summary.sales.total === 0;
  }

  private loadSales(): void {
    this.salesLoading.set(true);
    this.salesError.set(null);
    this.pos
      .salesCashReport({ ...this.periodQuery(), status: 'ALL', page: 1, pageSize: 1 })
      .pipe(finalize(() => this.salesLoading.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.sales.set(data);
          this.salesUpdatedAt.set(new Date().toISOString());
        },
        error: (error: HttpErrorResponse) => {
          this.sales.set(null);
          this.salesError.set(this.message(error, 'No fue posible consultar ventas y caja.'));
        },
      });
  }

  private loadMargin(): void {
    this.marginLoading.set(true);
    this.marginError.set(null);
    this.pos
      .profitabilityReport({ ...this.periodQuery(), page: 1, pageSize: 1 })
      .pipe(finalize(() => this.marginLoading.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.profitability.set(data);
          this.marginUpdatedAt.set(new Date().toISOString());
        },
        error: (error: HttpErrorResponse) => {
          this.profitability.set(null);
          this.marginError.set(this.message(error, 'No fue posible consultar costos y margen.'));
        },
      });
  }

  private loadStock(): void {
    this.stockLoading.set(true);
    this.stockError.set(null);
    forkJoin({
      low: this.inventory.listStockAlerts({ status: 'LOW', page: 1, pageSize: 1 }),
      out: this.inventory.listStockAlerts({ status: 'OUT_OF_STOCK', page: 1, pageSize: 1 }),
    })
      .pipe(finalize(() => this.stockLoading.set(false)))
      .subscribe({
        next: ({ low, out }) => {
          this.stockAlerts.set({
            low: low.meta.pagination.total,
            outOfStock: out.meta.pagination.total,
          });
          this.stockUpdatedAt.set(new Date().toISOString());
        },
        error: (error: HttpErrorResponse) => {
          this.stockAlerts.set({ low: 0, outOfStock: 0 });
          this.stockError.set(this.message(error, 'No fue posible consultar alertas de stock.'));
        },
      });
  }

  private loadPurchases(): void {
    this.purchaseLoading.set(true);
    this.purchaseError.set(null);
    this.purchases
      .list({ page: 1, pageSize: 1 })
      .pipe(finalize(() => this.purchaseLoading.set(false)))
      .subscribe({
        next: ({ meta }) => {
          this.purchaseTotal.set(meta.pagination.total);
          this.purchaseUpdatedAt.set(new Date().toISOString());
        },
        error: (error: HttpErrorResponse) => {
          this.purchaseTotal.set(0);
          this.purchaseError.set(this.message(error, 'No fue posible consultar compras.'));
        },
      });
  }

  private async loadSync(): Promise<void> {
    const session = this.session();
    if (!session) return;
    this.syncLoading.set(true);
    this.syncError.set(null);
    try {
      const scope = {
        tenantId: session.tenant.id,
        userId: session.user.id,
        deviceId: await this.offline.deviceId(),
        branchId: session.context.branch?.id ?? null,
        cashRegisterId: session.context.cashRegister?.id ?? null,
      };
      const [summary, commands, freshness] = await Promise.all([
        this.offline.summary(scope),
        this.offline.outbox(scope),
        this.offline.freshness(scope),
      ]);
      this.sync.set({
        entities: summary?.entities ?? 0,
        pending: commands.filter(
          ({ status, retryable }) =>
            status === 'PENDING' || status === 'SENT' || (status === 'ERROR' && retryable),
        ).length,
        conflicts: commands.filter(({ status, retryable }) => status === 'ERROR' && !retryable)
          .length,
        generatedAt: summary?.generatedAt ?? null,
        freshness: freshness.condition,
      });
      this.syncUpdatedAt.set(new Date().toISOString());
    } catch {
      this.sync.set(null);
      this.syncError.set('No fue posible leer el estado local de sincronización.');
    } finally {
      this.syncLoading.set(false);
    }
  }

  private periodQuery() {
    const period = this.periodForm.getRawValue();
    const branchId = this.session()?.context.branch?.id;
    return {
      ...(period.dateFrom ? { dateFrom: period.dateFrom } : {}),
      ...(period.dateTo ? { dateTo: period.dateTo } : {}),
      ...(branchId ? { branchId } : {}),
    };
  }

  private today(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private storageKey(): string | null {
    const session = this.session();
    return session ? `uinventario:dashboard:${session.tenant.id}:${session.user.id}` : null;
  }

  private restoreConfiguration(): void {
    const key = this.storageKey();
    if (!key || typeof localStorage === 'undefined') return;
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? '{}') as DashboardPreferences;
      this.configured.update(
        (current) =>
          Object.fromEntries(
            Object.entries(current).map(([widget, enabled]) => [
              widget,
              typeof saved[widget as DashboardWidget] === 'boolean'
                ? saved[widget as DashboardWidget]
                : enabled,
            ]),
          ) as Record<DashboardWidget, boolean>,
      );
      if (typeof saved.period?.dateFrom === 'string' && typeof saved.period?.dateTo === 'string') {
        this.periodForm.setValue({
          dateFrom: saved.period.dateFrom,
          dateTo: saved.period.dateTo,
        });
      }
    } catch {
      // A malformed personal preference must not block the operational dashboard.
    }
  }

  private persistConfiguration(): void {
    const key = this.storageKey();
    if (key && typeof localStorage !== 'undefined') {
      localStorage.setItem(
        key,
        JSON.stringify({ ...this.configured(), period: this.periodForm.getRawValue() }),
      );
    }
  }

  private message(error: HttpErrorResponse, fallback: string): string {
    if (error.status === 0) return 'No fue posible conectar con el servicio.';
    if (error.status === 403) return 'No tienes permiso para consultar esta métrica.';
    return fallback;
  }
}
