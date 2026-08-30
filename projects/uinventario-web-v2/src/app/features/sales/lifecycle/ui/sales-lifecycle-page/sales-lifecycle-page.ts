import { CurrencyPipe, DatePipe } from '@angular/common';
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
import { finalize } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { AuthorizationService } from '../../../../../core/authorization/authorization.service';
import { SalesLifecycleFacade } from '../../application/sales-lifecycle.facade';
import { SaleSummary } from '../../domain/sales-lifecycle.models';
import { SaleDetailPanel } from '../sale-detail-panel/sale-detail-panel';
import { SuspendedSalesPanel } from '../suspended-sales-panel/suspended-sales-panel';

type LifecycleView = 'SALES' | 'SUSPENDED';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    SaleDetailPanel,
    SuspendedSalesPanel,
  ],
  selector: 'ui-sales-lifecycle-page',
  styleUrls: ['./sales-lifecycle-page.scss', './sales-lifecycle-responsive.scss'],
  templateUrl: './sales-lifecycle-page.html',
})
export class SalesLifecyclePage implements OnInit {
  private readonly facade = inject(SalesLifecycleFacade);
  private readonly authorization = inject(AuthorizationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly view = signal<LifecycleView>('SALES');
  protected readonly canManage = computed(() => this.authorization.has('SALES_MANAGE'));
  protected readonly filterForm = this.formBuilder.nonNullable.group({
    receipt: [''],
    dateFrom: [''],
    dateTo: [''],
  });
  protected readonly sales = signal<readonly SaleSummary[]>([]);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly selectedSaleId = signal<string | null>(null);

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.view.set(params.get('view') === 'suspended' && this.canManage() ? 'SUSPENDED' : 'SALES');
    });
    this.loadSales();
  }

  protected visibleSales(): readonly SaleSummary[] {
    const query = this.filterForm.controls.receipt.value.trim().toLocaleLowerCase();
    if (!query) return this.sales();
    return this.sales().filter(
      (sale) =>
        sale.receiptNumber.toLocaleLowerCase().includes(query) ||
        sale.customer?.name.toLocaleLowerCase().includes(query),
    );
  }

  protected selectView(view: LifecycleView): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: view === 'SUSPENDED' ? 'suspended' : 'sales' },
      queryParamsHandling: 'merge',
    });
  }

  protected applyFilters(): void {
    this.page.set(1);
    this.selectedSaleId.set(null);
    this.loadSales();
  }

  protected movePage(direction: -1 | 1): void {
    const next = this.page() + direction;
    if (next < 1 || next > this.totalPages()) return;
    this.page.set(next);
    this.selectedSaleId.set(null);
    this.loadSales();
  }

  protected saleChanged(): void {
    this.loadSales();
  }

  private loadSales(): void {
    this.loading.set(true);
    this.error.set(null);
    const { dateFrom, dateTo } = this.filterForm.getRawValue();
    this.facade
      .listSales({
        page: this.page(),
        pageSize: 20,
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ items, pagination }) => {
          this.sales.set(items);
          this.total.set(pagination.total);
          this.totalPages.set(Math.max(1, pagination.totalPages));
        },
        error: (error: unknown) =>
          this.error.set(
            error instanceof ApiError ? error.message : 'No fue posible consultar las ventas.',
          ),
      });
  }
}
