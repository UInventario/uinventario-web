import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { csvBlob, downloadCsv } from '../../application/csv-export';
import { ReportFacade } from '../../application/report.facade';
import { reportMoney } from '../../application/report-format';
import { reportQueryFrom, reportQueryParams } from '../../application/report-query';
import { PagedReport } from '../../domain/report.gateway';
import { ProfitabilityReport, ReportQuery } from '../../domain/report.models';
import { ReportFilterBar } from '../report-filter-bar/report-filter-bar';
import { ReportPaginationComponent } from '../report-pagination/report-pagination';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReportFilterBar, ReportPaginationComponent],
  selector: 'ui-profitability-report-page',
  styleUrl: '../report-view.scss',
  templateUrl: './profitability-report-page.html',
})
export class ProfitabilityReportPage implements OnInit {
  private readonly facade = inject(ReportFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly query = signal<ReportQuery>({ page: 1, pageSize: 25, status: 'ALL' });
  protected readonly result = signal<PagedReport<ProfitabilityReport> | null>(null);
  protected readonly money = reportMoney;
  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const query = reportQueryFrom(params);
      this.query.set(query);
      this.load(query);
    });
  }
  protected apply(query: ReportQuery): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: reportQueryParams(query),
    });
  }
  protected goToPage(page: number): void {
    this.apply({ ...this.query(), page });
  }
  protected export(): void {
    const rows = this.result()?.data.products ?? [];
    downloadCsv(
      csvBlob(
        [
          'Producto',
          'SKU',
          'Moneda',
          'Vendido',
          'Devuelto',
          'Ingreso neto',
          'Impuestos',
          'Costo neto',
          'Margen',
        ],
        rows.map((row) => [
          row.product.name,
          row.product.sku,
          row.currency,
          row.soldQuantity,
          row.returnedQuantity,
          row.netRevenue,
          row.taxes,
          row.netCost,
          row.margin,
        ]),
      ),
      'reporte-margenes.csv',
    );
  }
  private load(query: ReportQuery): void {
    this.loading.set(true);
    this.error.set(null);
    this.facade
      .profitability(query)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error: unknown) =>
          this.error.set(
            error instanceof ApiError ? error.message : 'No fue posible calcular los márgenes.',
          ),
      });
  }
}
