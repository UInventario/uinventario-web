import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { PosFacade } from '../../application/pos.facade';
import { PosCustomer, PosLoyaltyStatement, PosSaleTerms } from '../../domain/pos.models';

const POSITIVE_MONEY = /^(?:[1-9]\d{0,11}(?:\.\d{1,2})?|0\.(?:0[1-9]|[1-9]\d?))$/;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-pos-benefits-dialog',
  styleUrl: './pos-benefits-dialog.scss',
  templateUrl: './pos-benefits-dialog.html',
})
export class PosBenefitsDialog implements OnInit {
  private readonly facade = inject(PosFacade);
  private readonly formBuilder = inject(FormBuilder);

  readonly current = input.required<PosSaleTerms>();
  readonly canDiscount = input(false);
  readonly closed = output<void>();
  readonly submitted = output<PosSaleTerms>();

  protected readonly customers = signal<readonly PosCustomer[]>([]);
  protected readonly customer = signal<PosCustomer | null>(null);
  protected readonly statement = signal<PosLoyaltyStatement | null>(null);
  protected readonly searching = signal(false);
  protected readonly loadingLoyalty = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = this.formBuilder.nonNullable.group({
    query: [''],
    discountEnabled: [false],
    discountType: ['PERCENT' as 'PERCENT' | 'AMOUNT'],
    discountValue: ['', Validators.pattern(POSITIVE_MONEY)],
    discountReason: ['', Validators.maxLength(240)],
    loyaltyPoints: [
      0,
      [Validators.min(0), Validators.max(10_000_000), Validators.pattern(/^\d+$/)],
    ],
    confirmRedemption: [false],
  });

  ngOnInit(): void {
    const current = this.current();
    this.customer.set(current.customer);
    this.form.patchValue({
      discountEnabled: this.canDiscount() && Boolean(current.discount),
      discountType: current.discount?.type ?? 'PERCENT',
      discountValue: current.discount?.value ?? '',
      discountReason: current.discount?.reason ?? '',
      loyaltyPoints: current.loyaltyPointsToRedeem ?? 0,
      confirmRedemption: Boolean(current.loyaltyPointsToRedeem),
    });
    if (current.customer) this.loadLoyalty(current.customer.id);
  }

  protected search(): void {
    const query = this.form.controls.query.value.trim();
    if (query.length < 2 || this.searching()) return;
    this.searching.set(true);
    this.error.set(null);
    this.facade
      .searchCustomers(query)
      .pipe(finalize(() => this.searching.set(false)))
      .subscribe({
        next: ({ customers }) => this.customers.set(customers),
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected selectCustomer(customer: PosCustomer): void {
    this.customer.set(customer);
    this.customers.set([]);
    this.form.patchValue({ query: '', loyaltyPoints: 0, confirmRedemption: false });
    this.loadLoyalty(customer.id);
  }

  protected clearCustomer(): void {
    this.customer.set(null);
    this.statement.set(null);
    this.form.patchValue({ loyaltyPoints: 0, confirmRedemption: false });
  }

  protected submit(): void {
    const value = this.form.getRawValue();
    const points = Number(value.loyaltyPoints);
    const discountInvalid =
      value.discountEnabled &&
      (!value.discountValue ||
        value.discountReason.trim().length < 3 ||
        (value.discountType === 'PERCENT' && Number(value.discountValue) > 100));
    const redemptionInvalid =
      points > 0 &&
      (!this.customer() ||
        !value.confirmRedemption ||
        !Number.isInteger(points) ||
        points > (this.statement()?.balance ?? 0));
    if (this.form.invalid || discountInvalid || redemptionInvalid) {
      this.form.markAllAsTouched();
      this.error.set(
        redemptionInvalid
          ? 'Confirma un canje que no exceda el saldo disponible del cliente.'
          : 'Revisa el descuento y captura un motivo de al menos 3 caracteres.',
      );
      return;
    }
    this.submitted.emit({
      customer: this.customer(),
      ...(this.canDiscount() && value.discountEnabled
        ? {
            discount: {
              type: value.discountType,
              value: value.discountValue.trim(),
              reason: value.discountReason.trim(),
            },
          }
        : {}),
      ...(points > 0 ? { loyaltyPointsToRedeem: points } : {}),
    });
  }

  private loadLoyalty(customerId: string): void {
    this.loadingLoyalty.set(true);
    this.error.set(null);
    this.facade
      .loyaltyStatement(customerId)
      .pipe(finalize(() => this.loadingLoyalty.set(false)))
      .subscribe({
        next: (statement) => this.statement.set(statement),
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  private messageFor(error: unknown): string {
    return error instanceof ApiError ? error.message : 'No fue posible consultar los beneficios.';
  }
}
