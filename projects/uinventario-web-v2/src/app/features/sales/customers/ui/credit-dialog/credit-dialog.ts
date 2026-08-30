import { ChangeDetectionStrategy, Component, OnInit, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreditInput, Customer } from '../../domain/customer.models';

const MONEY_PATTERN = /^(0|[1-9]\d{0,11})(\.\d{1,2})?$/;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-customer-credit-dialog',
  styleUrl: '../customer-dialog.scss',
  templateUrl: './credit-dialog.html',
})
export class CustomerCreditDialog implements OnInit {
  readonly customer = input.required<Customer>();
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  readonly closed = output<void>();
  readonly submitted = output<CreditInput>();

  protected readonly form = new FormBuilder().nonNullable.group({
    enabled: [false],
    creditLimit: ['0', [Validators.required, Validators.pattern(MONEY_PATTERN)]],
    currency: ['MXN', [Validators.required, Validators.pattern(/^[A-Z]{3}$/)]],
    termDays: [30, [Validators.required, Validators.min(1), Validators.max(365)]],
    maxInstallments: [1, [Validators.required, Validators.min(1), Validators.max(36)]],
  });

  ngOnInit(): void {
    const credit = this.customer().credit;
    if (!credit) return;
    this.form.reset({
      enabled: credit.enabled,
      creditLimit: credit.limit,
      currency: credit.currency,
      termDays: credit.termDays,
      maxInstallments: credit.maxInstallments,
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitted.emit({ ...this.form.getRawValue(), version: this.customer().version });
  }
}
