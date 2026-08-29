import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  CustomerApiService,
  CustomerCreditPaymentData,
  CustomerCreditPaymentMethod,
  CustomerCreditStatementData,
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
  readonly canManageCredit = input(false);
  readonly paymentMethods = input<readonly string[]>(['CASH']);
  readonly saleSelected = output<string>();
  readonly customerUpdated = output<CustomerData>();
  readonly dismissed = output<void>();
  protected readonly history = signal<CustomerHistoryData | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(0);
  protected readonly total = signal(0);
  protected readonly paymentSaving = signal(false);
  protected readonly paymentSuccess = signal<string | null>(null);
  protected readonly paymentError = signal<string | null>(null);
  protected readonly reversingPaymentId = signal<string | null>(null);
  protected readonly paymentForm = this.formBuilder.nonNullable.group({
    amount: [
      '',
      [
        Validators.required,
        Validators.pattern(/^(?:0\.(?:0[1-9]|[1-9]\d)|[1-9]\d{0,13}(?:\.\d{1,2})?)$/),
      ],
    ],
    method: ['CASH' as CustomerCreditPaymentMethod, Validators.required],
    reference: [''],
  });
  protected readonly reversalForm = this.formBuilder.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(160)]],
  });
  private paymentKey: string | null = null;
  private reversalKey: string | null = null;
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
    effect(() => {
      const defaultMethod = this.defaultPaymentMethod();
      if (!this.paymentMethods().includes(this.paymentForm.controls.method.value)) {
        this.paymentForm.controls.method.setValue(defaultMethod);
      }
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

  protected submitCreditPayment(): void {
    if (this.paymentForm.invalid || this.paymentSaving()) {
      this.paymentForm.markAllAsTouched();
      return;
    }
    const statement = this.history()?.credit;
    const value = this.paymentForm.getRawValue();
    const reference = value.reference.trim();
    if (!statement || Number(statement.balance) <= 0) {
      this.paymentError.set('El cliente no tiene deuda pendiente.');
      return;
    }
    if (Number(value.amount) > Number(statement.balance)) {
      this.paymentError.set('El abono no puede superar el saldo pendiente.');
      return;
    }
    if (!this.paymentMethods().includes(value.method)) {
      this.paymentError.set('El medio de pago no está disponible en este ambiente.');
      return;
    }
    if (value.method !== 'CASH' && reference.length < 4) {
      this.paymentError.set('Captura la referencia de tarjeta o transferencia.');
      return;
    }
    this.paymentKey ??= `web-credit-payment-${globalThis.crypto.randomUUID()}`;
    this.paymentSaving.set(true);
    this.paymentError.set(null);
    this.paymentSuccess.set(null);
    this.api
      .createCreditPayment(
        this.customer().id,
        {
          amount: value.amount,
          method: value.method,
          ...(value.method === 'CASH' ? {} : { reference }),
        },
        this.paymentKey,
      )
      .pipe(finalize(() => this.paymentSaving.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.paymentKey = null;
          this.paymentForm.reset({
            amount: '',
            method: this.defaultPaymentMethod(),
            reference: '',
          });
          this.paymentSuccess.set(`Abono ${data.payment.receiptNumber} aplicado.`);
          this.applyStatement(data.credit);
        },
        error: (error: HttpErrorResponse) => {
          this.paymentError.set(this.message(error, 'No fue posible registrar el abono.'));
        },
      });
  }

  protected beginReversal(payment: CustomerCreditPaymentData): void {
    this.reversingPaymentId.set(payment.id);
    this.reversalForm.reset({ reason: '' });
    this.reversalKey = null;
    this.paymentError.set(null);
  }

  protected cancelReversal(): void {
    this.reversingPaymentId.set(null);
    this.reversalKey = null;
  }

  protected reverseCreditPayment(payment: CustomerCreditPaymentData): void {
    if (this.reversalForm.invalid || this.paymentSaving()) {
      this.reversalForm.markAllAsTouched();
      return;
    }
    this.reversalKey ??= `web-credit-payment-reversal-${globalThis.crypto.randomUUID()}`;
    this.paymentSaving.set(true);
    this.paymentError.set(null);
    this.paymentSuccess.set(null);
    this.api
      .reverseCreditPayment(
        this.customer().id,
        payment.id,
        this.reversalForm.controls.reason.value.trim(),
        this.reversalKey,
      )
      .pipe(finalize(() => this.paymentSaving.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.reversalKey = null;
          this.reversingPaymentId.set(null);
          this.paymentSuccess.set(`Abono ${payment.receiptNumber} reversado.`);
          this.applyStatement(data.credit);
        },
        error: (error: HttpErrorResponse) => {
          this.paymentError.set(this.message(error, 'No fue posible reversar el abono.'));
        },
      });
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

  private applyStatement(statement: CustomerCreditStatementData | null): void {
    const current = this.history();
    if (current) this.history.set({ ...current, credit: statement });
    const customer = this.customer();
    if (!customer.credit || !statement) return;
    const available = Math.max(0, Number(customer.credit.limit) - Number(statement.balance));
    const updated: CustomerData = {
      ...customer,
      credit: {
        ...customer.credit,
        balance: statement.balance,
        available: available.toFixed(2),
        overdueAmount: statement.overdueAmount,
        status:
          Number(statement.overdueAmount) > 0
            ? 'OVERDUE'
            : available === 0
              ? 'LIMIT_REACHED'
              : 'AVAILABLE',
      },
    };
    this.customerUpdated.emit(updated);
  }

  private message(error: HttpErrorResponse, fallback: string): string {
    return typeof error.error?.message === 'string' ? error.error.message : fallback;
  }

  private defaultPaymentMethod(): CustomerCreditPaymentMethod {
    return (
      (['CASH', 'CARD', 'TRANSFER'] as const).find((method) =>
        this.paymentMethods().includes(method),
      ) ?? 'CASH'
    );
  }
}
