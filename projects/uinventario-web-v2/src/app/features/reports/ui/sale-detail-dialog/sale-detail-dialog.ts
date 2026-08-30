import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  input,
  output,
  inject,
  signal,
} from '@angular/core';
import { finalize, forkJoin, of } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { ReportFacade } from '../../application/report.facade';
import { reportDate, reportMoney } from '../../application/report-format';
import { SaleDetail, SaleReturn } from '../../domain/report.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'ui-sale-detail-dialog',
  styleUrl: './sale-detail-dialog.scss',
  templateUrl: './sale-detail-dialog.html',
})
export class SaleDetailDialog implements OnInit {
  private readonly facade = inject(ReportFacade);
  readonly saleId = input.required<string>();
  readonly timezone = input('UTC');
  readonly canViewReturns = input(false);
  readonly closed = output<void>();
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly sale = signal<SaleDetail | null>(null);
  protected readonly returns = signal<readonly SaleReturn[]>([]);
  protected readonly money = reportMoney;
  protected readonly date = reportDate;

  ngOnInit(): void {
    forkJoin({
      sale: this.facade.sale(this.saleId()),
      returns: this.canViewReturns() ? this.facade.saleReturns(this.saleId()) : of([]),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ sale, returns }) => {
          this.sale.set(sale);
          this.returns.set(returns);
        },
        error: (error: unknown) =>
          this.error.set(
            error instanceof ApiError ? error.message : 'No fue posible consultar la venta.',
          ),
      });
  }
}
