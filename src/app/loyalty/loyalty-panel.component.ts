import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, finalize } from 'rxjs';
import { CustomerApiService, CustomerData } from '../customers/customer-api.service';
import { LoyaltyApiService, LoyaltyRuleData, LoyaltyStatementData } from './loyalty-api.service';

const POSITIVE_MONEY = /^(?:[1-9]\d{0,11}(?:\.\d{1,2})?|0\.(?:0[1-9]|[1-9]\d?))$/;

@Component({
  selector: 'app-loyalty-panel',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './loyalty-panel.component.html',
  styleUrl: './loyalty-panel.component.scss',
})
export class LoyaltyPanelComponent {
  private readonly api = inject(LoyaltyApiService);
  private readonly customersApi = inject(CustomerApiService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly rule = signal<LoyaltyRuleData | null>(null);
  protected readonly customers = signal<CustomerData[]>([]);
  protected readonly statement = signal<LoyaltyStatementData | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    active: [true],
    earnAmount: ['1.00', [Validators.required, Validators.pattern(POSITIVE_MONEY)]],
    earnPoints: [1, [Validators.required, Validators.min(1), Validators.max(1_000_000)]],
    redeemPoints: [100, [Validators.required, Validators.min(1), Validators.max(1_000_000)]],
    redeemAmount: ['1.00', [Validators.required, Validators.pattern(POSITIVE_MONEY)]],
    expirationDays: [365, [Validators.min(1), Validators.max(3650)]],
    customerId: [''],
  });

  constructor() {
    this.load();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api
      .saveRule({
        active: value.active,
        earnAmount: value.earnAmount,
        earnPoints: value.earnPoints,
        redeemPoints: value.redeemPoints,
        redeemAmount: value.redeemAmount,
        ...(value.expirationDays ? { expirationDays: value.expirationDays } : {}),
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.rule.set(data);
          this.success.set(
            `Regla v${data.version} publicada; las ventas anteriores conservan su versión.`,
          );
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  protected loadStatement(): void {
    const customerId = this.form.controls.customerId.value;
    this.statement.set(null);
    if (!customerId) return;
    this.error.set(null);
    this.api.statement(customerId).subscribe({
      next: ({ data }) => this.statement.set(data),
      error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
    });
  }

  protected entryLabel(type: LoyaltyStatementData['entries'][number]['type']): string {
    return {
      EARN: 'Acumulación',
      REDEEM: 'Canje',
      EXPIRE: 'Expiración',
      VOID_EARN_REVERSAL: 'Reverso por anulación',
      VOID_REDEEM_RESTORE: 'Restitución por anulación',
      RETURN_EARN_REVERSAL: 'Reverso por devolución',
      RETURN_REDEEM_RESTORE: 'Restitución por devolución',
    }[type];
  }

  private load(): void {
    this.loading.set(true);
    forkJoin({
      rule: this.api.currentRule(),
      customers: this.customersApi.list({ status: 'ACTIVE', page: 1, pageSize: 100 }),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ rule, customers }) => {
          this.customers.set(customers.data);
          this.rule.set(rule.data);
          if (rule.data) {
            this.form.patchValue({
              active: rule.data.active,
              earnAmount: rule.data.earnAmount,
              earnPoints: rule.data.earnPoints,
              redeemPoints: rule.data.redeemPoints,
              redeemAmount: rule.data.redeemAmount,
              expirationDays: rule.data.expirationDays ?? 365,
            });
          }
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  private message(error: HttpErrorResponse): string {
    if (error.status === 403) return 'No tienes permiso para gestionar fidelización.';
    if (error.status === 0) return 'No fue posible conectar con fidelización.';
    return 'No fue posible completar la operación de fidelización.';
  }
}
