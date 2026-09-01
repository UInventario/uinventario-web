import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { AuthorizationService } from '../../../../core/authorization/authorization.service';
import { csvBlob, downloadCsv } from '../../application/csv-export';
import { ReportFacade } from '../../application/report.facade';
import { reportDate, reportMoney } from '../../application/report-format';
import { reportQueryFrom, reportQueryParams } from '../../application/report-query';
import { PagedReport } from '../../domain/report.gateway';
import { ProfitabilityReport, ReportQuery } from '../../domain/report.models';
import { ReportFilterBar } from '../report-filter-bar/report-filter-bar';
import { ReportPaginationComponent } from '../report-pagination/report-pagination';
import { SaleDetailDialog } from '../sale-detail-dialog/sale-detail-dialog';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReportFilterBar, ReportPaginationComponent, SaleDetailDialog],
  selector: 'ui-activity-report-page',
  styleUrl: '../report-view.scss',
  templateUrl: './activity-report-page.html',
})
export class ActivityReportPage implements OnInit {
  private readonly facade = inject(ReportFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authorization = inject(AuthorizationService);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly query = signal<ReportQuery>({ page: 1, pageSize: 25, status: 'ALL' });
  protected readonly result = signal<PagedReport<ProfitabilityReport> | null>(null);
  protected readonly selectedSale = signal<{ id: string; timezone: string } | null>(null);
  protected readonly canViewReturns = computed(() => this.authorization.has('SALES_RETURN'));
  protected readonly money = reportMoney;
  protected readonly date = reportDate;
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
  protected timezone(branchName: string): string {
    return (
      this.result()?.data.scope.find((branch) => branch.name === branchName)?.timezone ?? 'UTC'
    );
  }
  protected export(): void {
    const rows = this.result()?.data.activities ?? [];
    downloadCsv(
      csvBlob(
        [
          'Tipo',
          'Folio',
          'Sucursal',
          'Caja',
          'Fecha local',
          'Moneda',
          'Ingreso neto',
          'Costo histórico',
          'Impacto margen',
          'Liquidación',
          'Conciliado',
        ],
        rows.map((row) => [
          row.type,
          row.receiptNumber,
          row.branchName,
          row.cashRegisterName,
          this.date(row.occurredAt, this.timezone(row.branchName)),
          row.currency,
          row.netRevenue,
          row.historicalCost,
          row.marginImpact,
          row.paymentOrSettlement,
          row.reconciles ? 'Sí' : 'No',
        ]),
      ),
      'reporte-actividad.csv',
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
            error instanceof ApiError ? error.message : 'No fue posible consultar la actividad.',
          ),
      });
  }
}
