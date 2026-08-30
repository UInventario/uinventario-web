import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { csvBlob, downloadCsv } from '../../application/csv-export';
import { ReportFacade } from '../../application/report.facade';
import { reportDate } from '../../application/report-format';
import { reportQueryFrom, reportQueryParams } from '../../application/report-query';
import { PagedReport } from '../../domain/report.gateway';
import {
  InventoryActivityReport,
  InventoryActivityRow,
  ReportQuery,
} from '../../domain/report.models';
import { InventoryMovementDialog } from '../inventory-movement-dialog/inventory-movement-dialog';
import { ReportFilterBar } from '../report-filter-bar/report-filter-bar';
import { ReportPaginationComponent } from '../report-pagination/report-pagination';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InventoryMovementDialog, ReportFilterBar, ReportPaginationComponent],
  selector: 'ui-inventory-report-page',
  styleUrl: '../report-view.scss',
  templateUrl: './inventory-report-page.html',
})
export class InventoryReportPage implements OnInit {
  private readonly facade = inject(ReportFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly query = signal<ReportQuery>({ page: 1, pageSize: 25, status: 'ALL' });
  protected readonly result = signal<PagedReport<InventoryActivityReport> | null>(null);
  protected readonly selected = signal<InventoryActivityRow | null>(null);
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
  protected timezone(): string {
    const data = this.result()?.data;
    return (
      data?.scope.branches.find((branch) => branch.id === this.query().branchId)?.timezone ??
      (data?.scope.branches.length === 1 ? data.scope.branches[0].timezone : 'UTC')
    );
  }
  protected export(): void {
    const rows = this.result()?.data.items ?? [];
    downloadCsv(
      csvBlob(
        [
          'Producto',
          'SKU',
          'Categoría',
          'Apertura',
          'Cierre',
          'Venta neta',
          'Pérdida',
          'Actividad',
          'Rotación',
          'Estado',
          'Último movimiento',
        ],
        rows.map((row) => [
          row.product.name,
          row.product.sku,
          row.product.category?.name,
          row.openingQuantity,
          row.closingQuantity,
          row.netSoldQuantity,
          row.lossQuantity,
          row.activityQuantity,
          row.rotation,
          row.status,
          this.date(row.lastMovementAt, this.timezone()),
        ]),
      ),
      'reporte-inventario.csv',
    );
  }
  private load(query: ReportQuery): void {
    this.loading.set(true);
    this.error.set(null);
    this.facade
      .inventoryActivity(query)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error: unknown) =>
          this.error.set(
            error instanceof ApiError ? error.message : 'No fue posible consultar el inventario.',
          ),
      });
  }
}
