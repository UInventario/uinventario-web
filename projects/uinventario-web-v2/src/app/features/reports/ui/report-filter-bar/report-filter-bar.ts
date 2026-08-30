import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { validPeriod } from '../../application/report-query';
import { BranchOption, ReportQuery } from '../../domain/report.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-report-filter-bar',
  styleUrl: './report-filter-bar.scss',
  templateUrl: './report-filter-bar.html',
})
export class ReportFilterBar {
  readonly query = input.required<ReportQuery>();
  readonly branches = input<readonly BranchOption[]>([]);
  readonly registers = input<
    readonly { id: string; name: string; code: string; branch_id: string }[]
  >([]);
  readonly users = input<readonly { id: string; email: string }[]>([]);
  readonly warehouses = input<
    readonly { id: string; name: string; branch: { id: string; name: string } }[]
  >([]);
  readonly categories = input<readonly { id: string; name: string }[]>([]);
  readonly showStatus = input(false);
  readonly showProduct = input(false);
  readonly applied = output<ReportQuery>();
  readonly error = signal<string | null>(null);

  protected readonly form = new FormBuilder().nonNullable.group({
    dateFrom: [''],
    dateTo: [''],
    branchId: [''],
    cashRegisterId: [''],
    userId: [''],
    warehouseId: [''],
    categoryId: [''],
    product: [''],
    status: ['ALL' as 'ALL' | 'COMPLETED' | 'VOIDED'],
  });

  constructor() {
    effect(() => {
      const query = this.query();
      this.form.setValue(
        {
          dateFrom: query.dateFrom ?? '',
          dateTo: query.dateTo ?? '',
          branchId: query.branchId ?? '',
          cashRegisterId: query.cashRegisterId ?? '',
          userId: query.userId ?? '',
          warehouseId: query.warehouseId ?? '',
          categoryId: query.categoryId ?? '',
          product: query.product ?? '',
          status: query.status ?? 'ALL',
        },
        { emitEvent: false },
      );
    });
  }

  protected submit(): void {
    const value = this.form.getRawValue();
    if (!validPeriod(value.dateFrom || undefined, value.dateTo || undefined)) {
      this.error.set('La fecha inicial no puede ser posterior a la fecha final.');
      return;
    }
    this.error.set(null);
    this.applied.emit({
      ...this.query(),
      dateFrom: value.dateFrom || undefined,
      dateTo: value.dateTo || undefined,
      branchId: value.branchId || undefined,
      cashRegisterId: value.cashRegisterId || undefined,
      userId: value.userId || undefined,
      warehouseId: value.warehouseId || undefined,
      categoryId: value.categoryId || undefined,
      product: value.product.trim() || undefined,
      status: value.status,
      page: 1,
    });
  }

  protected reset(): void {
    this.error.set(null);
    this.applied.emit({ page: 1, pageSize: this.query().pageSize, status: 'ALL' });
  }
}
