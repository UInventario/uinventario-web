import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  CustomerApiService,
  CustomerData,
  CustomerHistoryData,
  CustomerHistoryStatus,
} from './customer-api.service';

@Component({
  selector: 'app-customer-history-panel',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './customer-history-panel.component.html',
  styleUrl: './customer-history-panel.component.scss',
})
export class CustomerHistoryPanelComponent {
  private readonly api = inject(CustomerApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly pageSize = 5;

  readonly customer = input.required<CustomerData>();
  readonly saleSelected = output<string>();
  readonly dismissed = output<void>();
  protected readonly history = signal<CustomerHistoryData | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(0);
  protected readonly total = signal(0);
  protected readonly filters = this.formBuilder.nonNullable.group({
    status: ['ALL' as CustomerHistoryStatus],
    dateFrom: [''],
    dateTo: [''],
  });

  constructor() {
    effect(() => {
      const customer = this.customer();
      if (customer.id) this.load(1);
    });
  }

  protected applyFilters(): void {
    const value = this.filters.getRawValue();
    if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
      this.error.set('La fecha inicial no puede ser posterior a la final.');
      return;
    }
    this.load(1);
  }

  protected previous(): void {
    if (this.page() > 1) this.load(this.page() - 1);
  }

  protected next(): void {
    if (this.page() < this.totalPages()) this.load(this.page() + 1);
  }

  private load(page: number): void {
    const customer = this.customer();
    const value = this.filters.getRawValue();
    this.loading.set(true);
    this.error.set(null);
    this.api
      .history(customer.id, {
        status: value.status,
        ...(value.dateFrom ? { dateFrom: value.dateFrom } : {}),
        ...(value.dateTo ? { dateTo: value.dateTo } : {}),
        page,
        pageSize: this.pageSize,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ data, meta }) => {
          this.history.set(data);
          this.page.set(meta.pagination.page);
          this.totalPages.set(meta.pagination.totalPages);
          this.total.set(meta.pagination.total);
        },
        error: (error: HttpErrorResponse) => {
          this.history.set(null);
          this.error.set(
            typeof error.error?.message === 'string'
              ? error.error.message
              : 'No fue posible consultar el historial del cliente.',
          );
        },
      });
  }
}
