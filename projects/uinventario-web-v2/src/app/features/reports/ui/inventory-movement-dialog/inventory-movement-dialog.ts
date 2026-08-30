import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { ReportFacade } from '../../application/report.facade';
import { reportDate } from '../../application/report-format';
import { InventoryMovementRow, ReportPagination, ReportQuery } from '../../domain/report.models';
import { ReportPaginationComponent } from '../report-pagination/report-pagination';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReportPaginationComponent],
  selector: 'ui-inventory-movement-dialog',
  styleUrl: '../sale-detail-dialog/sale-detail-dialog.scss',
  templateUrl: './inventory-movement-dialog.html',
})
export class InventoryMovementDialog implements OnInit {
  private readonly facade = inject(ReportFacade);
  readonly productId = input.required<string>();
  readonly productName = input.required<string>();
  readonly query = input.required<ReportQuery>();
  readonly timezone = input('UTC');
  readonly closed = output<void>();
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = signal<readonly InventoryMovementRow[]>([]);
  protected readonly pagination = signal<ReportPagination>({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
  });
  protected readonly date = reportDate;
  ngOnInit(): void {
    this.load(1);
  }
  protected load(page: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.facade
      .inventoryMovements(this.productId(), { ...this.query(), page })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          this.rows.set(result.data);
          this.pagination.set(result.pagination);
        },
        error: (error: unknown) =>
          this.error.set(
            error instanceof ApiError ? error.message : 'No fue posible consultar los movimientos.',
          ),
      });
  }
}
