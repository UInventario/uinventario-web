import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { AuthorizationService } from '../../../../core/authorization/authorization.service';
import { SessionState } from '../../../../core/session/session-state';
import { DashboardFacade } from '../../application/dashboard.facade';
import { dashboardQueryFrom, dashboardQueryParams } from '../../application/dashboard-query';
import {
  DashboardQuery,
  DashboardSalesSummary,
  DashboardWidget,
  DemandForecast,
} from '../../domain/dashboard.models';

interface WidgetOption {
  readonly id: DashboardWidget;
  readonly label: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'ui-dashboard-overview-page',
  styleUrl: './dashboard-overview-page.scss',
  templateUrl: './dashboard-overview-page.html',
})
export class DashboardOverviewPage implements OnInit {
  private readonly api = inject(DashboardFacade);
  private readonly authorization = inject(AuthorizationService);
  private readonly sessions = inject(SessionState);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly filters = this.formBuilder.nonNullable.group({ dateFrom: '', dateTo: '' });
  protected readonly query = signal<DashboardQuery>({ dateFrom: '', dateTo: '', widgets: [] });
  protected readonly periodError = signal<string | null>(null);
  protected readonly loading = signal<ReadonlySet<DashboardWidget>>(new Set());
  protected readonly errors = signal<Partial<Record<DashboardWidget, string>>>({});
  protected readonly sales = signal<DashboardSalesSummary | null>(null);
  protected readonly stock = signal<{ readonly low: number; readonly outOfStock: number } | null>(
    null,
  );
  protected readonly purchases = signal<number | null>(null);
  protected readonly forecast = signal<DemandForecast | null>(null);
  protected readonly unread = signal<number | null>(null);
  protected readonly updatedAt = signal<string | null>(null);
  protected readonly widgetOptions = computed<readonly WidgetOption[]>(() => {
    const result: WidgetOption[] = [];
    if (this.authorization.has('SALES_MANAGE')) result.push({ id: 'sales', label: 'Ventas' });
    if (this.authorization.has('INVENTORY_VIEW')) result.push({ id: 'stock', label: 'Stock' });
    if (this.authorization.hasAny(['PURCHASE_ORDERS_MANAGE', 'PURCHASE_ORDERS_APPROVE'])) {
      result.push({ id: 'purchases', label: 'Compras' });
    }
    if (this.authorization.hasAll(['SALES_MANAGE', 'INVENTORY_VIEW'])) {
      result.push({ id: 'forecast', label: 'Pronóstico' });
    }
    if (this.authorization.has('NOTIFICATIONS_VIEW')) {
      result.push({ id: 'notifications', label: 'Notificaciones' });
    }
    return result;
  });
  protected readonly visibleWidgets = computed(() =>
    this.widgetOptions().filter(({ id }) => this.widgetEnabled(id)),
  );

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const query = dashboardQueryFrom(params);
      this.query.set(query);
      this.filters.setValue(
        { dateFrom: query.dateFrom, dateTo: query.dateTo },
        { emitEvent: false },
      );
      const missingState = ['from', 'to', 'widgets'].some((key) => !params.has(key));
      if (missingState) {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: dashboardQueryParams(query),
          replaceUrl: true,
        });
        return;
      }
      this.refresh();
    });
  }

  protected applyPeriod(): void {
    const period = this.filters.getRawValue();
    if (period.dateFrom > period.dateTo) {
      this.periodError.set('La fecha inicial no puede ser posterior a la fecha final.');
      return;
    }
    this.periodError.set(null);
    this.navigate({ ...this.query(), ...period });
  }

  protected toggleWidget(widget: DashboardWidget, checked: boolean): void {
    const current = new Set(this.query().widgets);
    if (checked) current.add(widget);
    else current.delete(widget);
    this.navigate({ ...this.query(), widgets: [...current] });
  }

  protected widgetEnabled(widget: DashboardWidget): boolean {
    return this.query().widgets.includes(widget);
  }

  protected widgetAvailable(widget: DashboardWidget): boolean {
    return this.widgetOptions().some(({ id }) => id === widget);
  }

  protected widgetLoading(widget: DashboardWidget): boolean {
    return this.loading().has(widget);
  }

  protected refresh(): void {
    for (const { id } of this.visibleWidgets()) this.loadWidget(id);
    this.updatedAt.set(new Date().toISOString());
  }

  private loadWidget(widget: DashboardWidget): void {
    this.start(widget);
    const period = { dateFrom: this.query().dateFrom, dateTo: this.query().dateTo };
    const branchId = this.sessions.session()?.context.branch?.id;
    if (widget === 'sales') {
      this.api
        .sales(period, branchId)
        .pipe(finalize(() => this.stop(widget)))
        .subscribe({
          next: (value) => this.sales.set(value),
          error: (error) => this.fail(widget, error),
        });
      return;
    }
    if (widget === 'stock') {
      forkJoin({
        low: this.api.stockAlertTotal('LOW'),
        outOfStock: this.api.stockAlertTotal('OUT_OF_STOCK'),
      })
        .pipe(finalize(() => this.stop(widget)))
        .subscribe({
          next: (value) => this.stock.set(value),
          error: (error) => this.fail(widget, error),
        });
      return;
    }
    if (widget === 'purchases') {
      this.api
        .purchaseTotal()
        .pipe(finalize(() => this.stop(widget)))
        .subscribe({
          next: (value) => this.purchases.set(value),
          error: (error) => this.fail(widget, error),
        });
      return;
    }
    if (widget === 'forecast') {
      this.api
        .latestForecast()
        .pipe(finalize(() => this.stop(widget)))
        .subscribe({
          next: (value) => this.forecast.set(value),
          error: (error) => this.fail(widget, error),
        });
      return;
    }
    this.api
      .notifications(false, undefined, 1)
      .pipe(finalize(() => this.stop(widget)))
      .subscribe({
        next: (value) => this.unread.set(value.unread),
        error: (error) => this.fail(widget, error),
      });
  }

  private navigate(query: DashboardQuery): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: dashboardQueryParams(query),
    });
  }

  private start(widget: DashboardWidget): void {
    this.loading.update((current) => new Set([...current, widget]));
    this.errors.update((current) => ({ ...current, [widget]: undefined }));
  }

  private stop(widget: DashboardWidget): void {
    this.loading.update((current) => {
      const next = new Set(current);
      next.delete(widget);
      return next;
    });
  }

  private fail(widget: DashboardWidget, error: unknown): void {
    this.errors.update((current) => ({
      ...current,
      [widget]: error instanceof ApiError ? error.message : 'No fue posible cargar este indicador.',
    }));
  }
}
