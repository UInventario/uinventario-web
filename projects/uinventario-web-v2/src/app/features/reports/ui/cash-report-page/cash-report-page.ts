import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { csvBlob, downloadCsv } from '../../application/csv-export';
import { ReportFacade } from '../../application/report.facade';
import { reportDate, reportMoney } from '../../application/report-format';
import { reportQueryFrom, reportQueryParams } from '../../application/report-query';
import { PagedReport } from '../../domain/report.gateway';
import { ReportQuery, SalesCashReport } from '../../domain/report.models';
import { ReportFilterBar } from '../report-filter-bar/report-filter-bar';
import { ReportPaginationComponent } from '../report-pagination/report-pagination';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReportFilterBar, ReportPaginationComponent],
  selector: 'ui-cash-report-page',
  styleUrl: '../report-view.scss',
  templateUrl: './cash-report-page.html',
})
export class CashReportPage implements OnInit {
  private readonly facade = inject(ReportFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly query = signal<ReportQuery>({ page: 1, pageSize: 25, status: 'ALL' });
  protected readonly result = signal<PagedReport<SalesCashReport> | null>(null);
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
  protected timezone(branchId: string): string {
    return this.result()?.data.scope.find((branch) => branch.id === branchId)?.timezone ?? 'UTC';
  }
  protected summaryCurrency(): string {
    const currencies = [
      ...new Set((this.result()?.data.shifts ?? []).map((shift) => shift.currency)),
    ];
    return currencies.length === 1 ? currencies[0] : 'moneda local';
  }
  protected export(): void {
    const rows = this.result()?.data.shifts ?? [];
    downloadCsv(
      csvBlob(
        [
          'Estado',
          'Sucursal',
          'Caja',
          'Responsable',
          'Apertura local',
          'Cierre local',
          'Moneda',
          'Inicial',
          'Esperado',
          'Contado',
          'Diferencia',
        ],
        rows.map((row) => [
          row.status,
          row.branch.name,
          row.cashRegister.name,
          row.openedByEmail,
          this.date(row.openedAt, this.timezone(row.branch.id)),
          this.date(row.closedAt, this.timezone(row.branch.id)),
          row.currency,
          row.opening,
          row.expected,
          row.counted,
          row.difference,
        ]),
      ),
      'reporte-caja.csv',
    );
  }
  private load(query: ReportQuery): void {
    this.loading.set(true);
    this.error.set(null);
    this.facade
      .salesCash(query)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error: unknown) =>
          this.error.set(
            error instanceof ApiError ? error.message : 'No fue posible consultar la caja.',
          ),
      });
  }
}
