import { DatePipe } from '@angular/common';
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
import { Observable, finalize } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { CustomerFacade } from '../../application/customer.facade';
import {
  Customer,
  CustomerCreditPayment,
  CustomerCreditPaymentMethod,
  CustomerCreditStatement,
  CustomerHistoryPage,
  CustomerPrivacyReport,
} from '../../domain/customer.models';

type DetailTab = 'HISTORY' | 'CREDIT' | 'PRIVACY';
type PrivacyAction = 'HOLD' | 'RELEASE' | 'ANONYMIZE';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule],
  selector: 'ui-customer-detail-dialog',
  styleUrls: ['./customer-detail-dialog.scss', './customer-credit-payment.scss'],
  templateUrl: './customer-detail-dialog.html',
})
export class CustomerDetailDialog implements OnInit {
  private readonly facade = inject(CustomerFacade);
  private readonly formBuilder = inject(FormBuilder);

  readonly customer = input.required<Customer>();
  readonly canCredit = input(false);
  readonly canPrivacy = input(false);
  readonly closed = output<void>();
  readonly changed = output<void>();

  protected readonly tab = signal<DetailTab>('HISTORY');
  protected readonly loading = signal(true);
  protected readonly acting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly history = signal<CustomerHistoryPage | null>(null);
  protected readonly credit = signal<CustomerCreditStatement | null>(null);
  protected readonly privacy = signal<CustomerPrivacyReport | null>(null);
  protected readonly privacyAction = signal<PrivacyAction | null>(null);
  protected readonly paymentOpen = signal(false);
  protected readonly reversingPayment = signal<CustomerCreditPayment | null>(null);
  protected readonly paymentForm = this.formBuilder.nonNullable.group({
    amount: [
      '',
      [
        Validators.required,
        Validators.pattern(/^(?:0\.(?:0[1-9]|[1-9]\d)|[1-9]\d{0,13}(?:\.\d{1,2})?)$/),
      ],
    ],
    method: ['CASH' as CustomerCreditPaymentMethod, Validators.required],
    reference: ['', Validators.maxLength(120)],
  });
  protected readonly reversalForm = this.formBuilder.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(160)]],
  });
  protected readonly actionForm = this.formBuilder.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(240)]],
    requestReference: ['', Validators.maxLength(120)],
    expiresAt: [''],
    confirmation: [''],
  });

  ngOnInit(): void {
    this.loadHistory();
  }

  protected selectTab(tab: DetailTab): void {
    if ((tab === 'CREDIT' && !this.canCredit()) || (tab === 'PRIVACY' && !this.canPrivacy()))
      return;
    this.tab.set(tab);
    this.error.set(null);
    this.notice.set(null);
    if (tab === 'CREDIT' && !this.credit()) this.loadCredit();
    if (tab === 'PRIVACY' && !this.privacy()) this.loadPrivacy();
  }

  protected beginAction(action: PrivacyAction): void {
    this.error.set(null);
    this.notice.set(null);
    this.actionForm.reset({ reason: '', requestReference: '', expiresAt: '', confirmation: '' });
    this.privacyAction.set(action);
  }

  protected openPayment(): void {
    const balance = this.credit()?.balance ?? '';
    this.paymentForm.reset({ amount: balance, method: 'CASH', reference: '' });
    this.error.set(null);
    this.notice.set(null);
    this.paymentOpen.set(true);
  }

  protected paymentNeedsReference(): boolean {
    return this.paymentForm.controls.method.value !== 'CASH';
  }

  protected submitCreditPayment(): void {
    const value = this.paymentForm.getRawValue();
    const reference = value.reference.trim();
    if (this.paymentNeedsReference() && !/^[A-Za-z0-9][A-Za-z0-9._:/-]{3,119}$/.test(reference)) {
      this.paymentForm.controls.reference.setErrors({ reference: true });
    }
    if (this.paymentForm.invalid || this.acting()) {
      this.paymentForm.markAllAsTouched();
      return;
    }
    this.acting.set(true);
    this.error.set(null);
    this.facade
      .createCreditPayment(this.customer().id, {
        amount: value.amount.trim(),
        method: value.method,
        ...(this.paymentNeedsReference() ? { reference } : {}),
      })
      .pipe(finalize(() => this.acting.set(false)))
      .subscribe({
        next: ({ payment, credit }) => {
          this.credit.set(credit);
          this.paymentOpen.set(false);
          this.notice.set(`Abono ${payment.receiptNumber} registrado correctamente.`);
        },
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected beginReversal(payment: CustomerCreditPayment): void {
    this.reversalForm.reset({ reason: '' });
    this.error.set(null);
    this.reversingPayment.set(payment);
  }

  protected submitReversal(): void {
    const payment = this.reversingPayment();
    if (!payment || this.reversalForm.invalid || this.acting()) {
      this.reversalForm.markAllAsTouched();
      return;
    }
    this.acting.set(true);
    this.error.set(null);
    this.facade
      .reverseCreditPayment(
        this.customer().id,
        payment.id,
        this.reversalForm.controls.reason.value.trim(),
      )
      .pipe(finalize(() => this.acting.set(false)))
      .subscribe({
        next: ({ credit }) => {
          this.credit.set(credit);
          this.reversingPayment.set(null);
          this.notice.set('El abono fue revertido y el saldo se recalculó.');
        },
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected submitPrivacyAction(): void {
    const action = this.privacyAction();
    const value = this.actionForm.getRawValue();
    if (action === 'ANONYMIZE' && value.confirmation.trim() !== this.customer().name) {
      this.actionForm.controls.confirmation.setErrors({ confirmation: true });
    }
    if (!action || this.actionForm.invalid || this.acting()) {
      this.actionForm.markAllAsTouched();
      return;
    }
    const common = {
      reason: value.reason.trim(),
      requestReference: value.requestReference.trim() || undefined,
    };
    const request =
      action === 'HOLD'
        ? this.facade.createLegalHold(this.customer().id, {
            ...common,
            expiresAt: value.expiresAt || undefined,
          })
        : action === 'RELEASE'
          ? this.facade.releaseLegalHold(this.customer().id, common)
          : this.facade.anonymize(this.customer().id, common);
    const notices = {
      HOLD: 'Bloqueo legal aplicado.',
      RELEASE: 'Bloqueo legal liberado.',
      ANONYMIZE: 'Datos personales anonimizados; las transacciones se conservaron.',
    } as const;
    this.runAction(request, notices[action], action === 'ANONYMIZE');
  }

  protected exportData(): void {
    if (this.acting()) return;
    this.acting.set(true);
    this.error.set(null);
    this.facade
      .exportPrivacy(this.customer().id)
      .pipe(finalize(() => this.acting.set(false)))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `cliente-${this.customer().id}-privacidad.json`;
          anchor.click();
          URL.revokeObjectURL(url);
          this.notice.set('Exportación generada y registrada en auditoría.');
          this.loadPrivacy();
        },
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  private loadHistory(): void {
    this.loading.set(true);
    this.facade
      .history(this.customer().id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (history) => this.history.set(history),
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  private loadCredit(): void {
    this.loading.set(true);
    this.facade
      .credit(this.customer().id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (credit) => this.credit.set(credit),
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  private loadPrivacy(): void {
    this.loading.set(true);
    this.facade
      .privacyReport(this.customer().id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (privacy) => this.privacy.set(privacy),
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  private runAction(request: Observable<unknown>, notice: string, customerChanged: boolean): void {
    this.acting.set(true);
    this.error.set(null);
    request.pipe(finalize(() => this.acting.set(false))).subscribe({
      next: () => {
        this.privacyAction.set(null);
        this.notice.set(notice);
        this.privacy.set(null);
        this.loadPrivacy();
        if (customerChanged) this.changed.emit();
      },
      error: (error: unknown) => this.error.set(this.messageFor(error)),
    });
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible consultar o actualizar al cliente.';
    if (error.code === 'CUSTOMER_ANONYMIZATION_BLOCKED_BY_LEGAL_HOLD')
      return 'No se puede anonimizar mientras exista un bloqueo legal activo.';
    const messages: Record<string, string> = {
      CREDIT_PAYMENT_EXCEEDS_BALANCE: 'El abono no puede superar el saldo pendiente.',
      CREDIT_PAYMENT_REFERENCE_INVALID:
        'La referencia es obligatoria para tarjeta o transferencia.',
      CREDIT_PAYMENT_ALREADY_REVERSED: 'Este abono ya fue revertido.',
      CREDIT_PAYMENT_REVERSAL_EXCEEDS_CASH:
        'La caja no tiene efectivo suficiente para devolver este abono.',
      CASH_REGISTER_SHIFT_REQUIRED: 'Abre un turno de caja antes de registrar el abono.',
      PAYMENT_DECLINED: 'El proveedor rechazó el abono. No se modificó el saldo.',
    };
    if (messages[error.code]) return messages[error.code];
    return error.message;
  }
}
