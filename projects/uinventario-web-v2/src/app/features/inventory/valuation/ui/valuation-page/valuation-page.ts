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
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { AuthorizationService } from '../../../../../core/authorization/authorization.service';
import { ValuationFacade } from '../../application/valuation.facade';
import {
  FifoLayerSet,
  ReconciliationRun,
  ValuationMigrationPlan,
  ValuationMethod,
  ValuationPolicy,
  ValuationStockItem,
  ValuationStockPage,
  ValuationStockQuery,
  ValuedMovementPage,
} from '../../domain/valuation.models';
import { PolicyDialog } from '../policy-dialog/policy-dialog';
import { ValuationDetail } from '../valuation-detail/valuation-detail';
import { ValuationStockList } from '../valuation-stock-list/valuation-stock-list';

type ValuationView = 'VALUATION' | 'RECONCILIATION';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    PolicyDialog,
    ReactiveFormsModule,
    RouterLink,
    ValuationDetail,
    ValuationStockList,
  ],
  selector: 'ui-valuation-page',
  styleUrls: [
    './valuation-page.scss',
    './valuation-reconciliation.scss',
    './valuation-responsive.scss',
  ],
  templateUrl: './valuation-page.html',
})
export class ValuationPage implements OnInit {
  private readonly authorization = inject(AuthorizationService);
  private readonly facade = inject(ValuationFacade);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private contextRevision = 0;
  private listRevision = 0;
  private detailRevision = 0;
  private listKey = '';
  private detailKey = '';
  private policyIdempotencyKey: string | null = null;
  private reconciliationIdempotencyKey: string | null = null;

  protected readonly canManagePolicy = computed(() =>
    this.authorization.has('INVENTORY_VALUATION_MANAGE'),
  );
  protected readonly canReconcile = computed(() => this.authorization.has('INVENTORY_ADJUST'));
  protected readonly view = signal<ValuationView>('VALUATION');
  protected readonly contextLoading = signal(true);
  protected readonly listLoading = signal(true);
  protected readonly detailLoading = signal(false);
  protected readonly previewing = signal(false);
  protected readonly savingPolicy = signal(false);
  protected readonly reconciling = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly policy = signal<ValuationPolicy | null>(null);
  protected readonly reconciliation = signal<ReconciliationRun | null>(null);
  protected readonly page = signal<ValuationStockPage | null>(null);
  protected readonly selected = signal<ValuationStockItem | null>(null);
  protected readonly layers = signal<FifoLayerSet | null>(null);
  protected readonly movements = signal<ValuedMovementPage | null>(null);
  protected readonly policyDialogOpen = signal(false);
  protected readonly policyPlan = signal<ValuationMigrationPlan | null>(null);
  protected readonly filters = this.formBuilder.nonNullable.group({ q: [''] });

  ngOnInit(): void {
    this.loadContext();
    this.route.queryParamMap.subscribe((params) => this.syncFrom(params));
  }

  protected selectView(view: ValuationView): void {
    this.clearMessages();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams:
        view === 'RECONCILIATION'
          ? { view: 'reconciliation', product: null, movementPage: null }
          : { view: null },
      queryParamsHandling: 'merge',
    });
  }

  protected applyFilters(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.filters.controls.q.value.trim() || null,
        page: null,
        product: null,
        movementPage: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected goToPage(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page <= 1 ? null : page, product: null, movementPage: null },
      queryParamsHandling: 'merge',
    });
  }

  protected selectProduct(item: ValuationStockItem): void {
    this.selected.set(item);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { product: item.product.id, movementPage: null },
      queryParamsHandling: 'merge',
    });
  }

  protected clearSelection(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { product: null, movementPage: null },
      queryParamsHandling: 'merge',
    });
  }

  protected goToMovementPage(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { movementPage: page <= 1 ? null : page },
      queryParamsHandling: 'merge',
    });
  }

  protected openPolicyDialog(): void {
    if (!this.canManagePolicy() || !this.policy()) return;
    this.clearMessages();
    this.policyPlan.set(null);
    this.policyIdempotencyKey = null;
    this.policyDialogOpen.set(true);
  }

  protected resetPolicyPlan(): void {
    this.policyPlan.set(null);
    this.policyIdempotencyKey = null;
    this.error.set(null);
  }

  protected previewPolicy(method: ValuationMethod): void {
    if (this.previewing()) return;
    this.previewing.set(true);
    this.error.set(null);
    this.facade
      .previewPolicy(method)
      .pipe(finalize(() => this.previewing.set(false)))
      .subscribe({
        next: (plan) => {
          this.policyPlan.set(plan);
          this.policyIdempotencyKey = this.idempotencyKey();
        },
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected changePolicy(plan: ValuationMigrationPlan): void {
    if (this.savingPolicy() || !this.policyIdempotencyKey) return;
    this.savingPolicy.set(true);
    this.error.set(null);
    this.facade
      .changePolicy(plan, this.policyIdempotencyKey)
      .pipe(finalize(() => this.savingPolicy.set(false)))
      .subscribe({
        next: (policy) => {
          this.policy.set(policy);
          this.policyDialogOpen.set(false);
          this.policyPlan.set(null);
          this.policyIdempotencyKey = null;
          this.notice.set('Política actualizada. La historia previa permanece sin reescritura.');
          this.refreshAfterControlChange();
        },
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected runReconciliation(): void {
    if (!this.canReconcile() || this.reconciling()) return;
    this.reconciliationIdempotencyKey ??= this.idempotencyKey();
    this.reconciling.set(true);
    this.error.set(null);
    this.facade
      .runReconciliation(this.reconciliationIdempotencyKey)
      .pipe(finalize(() => this.reconciling.set(false)))
      .subscribe({
        next: (run) => {
          this.reconciliation.set(run);
          this.reconciliationIdempotencyKey = null;
          this.notice.set(
            run.overallStatus === 'HEALTHY'
              ? 'Reconciliación completa: inventario saludable.'
              : 'Reconciliación completa: revisa los hallazgos detectados.',
          );
          this.refreshStockOnly();
        },
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected methodLabel(method: ValuationMethod): string {
    return {
      MOVING_AVERAGE: 'Promedio móvil',
      FIFO: 'FIFO',
      SPECIFIC_LOT: 'Lote específico',
    }[method];
  }

  protected statusLabel(status: ReconciliationRun['overallStatus']): string {
    return { HEALTHY: 'Saludable', WARNING: 'Con advertencias', CRITICAL: 'Crítico' }[status];
  }

  private syncFrom(params: ParamMap): void {
    const nextView: ValuationView =
      params.get('view') === 'reconciliation' ? 'RECONCILIATION' : 'VALUATION';
    this.view.set(nextView);
    if (nextView === 'VALUATION') {
      const query = this.stockQuery(params);
      this.filters.controls.q.setValue(query.q ?? '', { emitEvent: false });
      const listKey = JSON.stringify(query);
      if (listKey !== this.listKey) {
        this.listKey = listKey;
        this.loadStock(query);
      }
      const productId = params.get('product') ?? '';
      const movementPage = this.positiveInteger(params.get('movementPage'));
      const detailKey = productId ? `${productId}:${movementPage}` : '';
      if (detailKey !== this.detailKey) {
        this.detailKey = detailKey;
        this.layers.set(null);
        this.movements.set(null);
        if (productId) this.loadProduct(productId, movementPage);
        else this.selected.set(null);
      }
    }
  }

  private loadContext(): void {
    const revision = ++this.contextRevision;
    this.contextLoading.set(true);
    this.facade
      .context()
      .pipe(finalize(() => revision === this.contextRevision && this.contextLoading.set(false)))
      .subscribe({
        next: ({ policy, reconciliation }) => {
          if (revision !== this.contextRevision) return;
          this.policy.set(policy);
          this.reconciliation.set(reconciliation);
        },
        error: (error: unknown) =>
          revision === this.contextRevision && this.error.set(this.messageFor(error)),
      });
  }

  private loadStock(query: ValuationStockQuery): void {
    const revision = ++this.listRevision;
    this.listLoading.set(true);
    this.facade
      .stock(query)
      .pipe(finalize(() => revision === this.listRevision && this.listLoading.set(false)))
      .subscribe({
        next: (page) => {
          if (revision !== this.listRevision) return;
          this.page.set(page);
          const selectedId = this.route.snapshot.queryParamMap.get('product');
          if (selectedId) {
            this.selected.set(page.items.find((item) => item.product.id === selectedId) ?? null);
          }
        },
        error: (error: unknown) =>
          revision === this.listRevision && this.error.set(this.messageFor(error)),
      });
  }

  private loadProduct(productId: string, movementPage: number): void {
    const revision = ++this.detailRevision;
    this.detailLoading.set(true);
    this.facade
      .product(productId, movementPage)
      .pipe(finalize(() => revision === this.detailRevision && this.detailLoading.set(false)))
      .subscribe({
        next: ({ layers, movements }) => {
          if (revision !== this.detailRevision) return;
          this.layers.set(layers);
          this.movements.set(movements);
          if (!this.selected()) {
            const item = this.page()?.items.find((candidate) => candidate.product.id === productId);
            if (item) this.selected.set(item);
          }
        },
        error: (error: unknown) =>
          revision === this.detailRevision && this.error.set(this.messageFor(error)),
      });
  }

  private refreshAfterControlChange(): void {
    this.loadContext();
    this.refreshStockOnly();
    const productId = this.route.snapshot.queryParamMap.get('product');
    if (productId) {
      this.loadProduct(
        productId,
        this.positiveInteger(this.route.snapshot.queryParamMap.get('movementPage')),
      );
    }
  }

  private refreshStockOnly(): void {
    this.loadStock(this.stockQuery(this.route.snapshot.queryParamMap));
  }

  private stockQuery(params: ParamMap): ValuationStockQuery {
    return {
      q: params.get('q') ?? undefined,
      page: this.positiveInteger(params.get('page')),
      pageSize: 20,
    };
  }

  private positiveInteger(value: string | null): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
  }

  private clearMessages(): void {
    this.error.set(null);
    this.notice.set(null);
  }

  private idempotencyKey(): string {
    return `web-${crypto.randomUUID()}`;
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible consultar el control de inventario.';
    const messages: Record<string, string> = {
      VALUATION_POLICY_VERSION_CONFLICT: 'La política cambió. Genera una prevalidación nueva.',
      VALUATION_MIGRATION_PLAN_STALE: 'El inventario cambió. Prevalida nuevamente el impacto.',
      VALUATION_METHOD_CHANGE_BLOCKED: 'Resuelve los desbalances antes de cambiar el método.',
      VALUATION_POLICY_IDEMPOTENCY_CONFLICT: 'La operación ya fue usada para otro cambio.',
      INVENTORY_RECONCILIATION_NOT_FOUND: 'La reconciliación solicitada ya no está disponible.',
    };
    return (error.code && messages[error.code]) || error.message;
  }
}
