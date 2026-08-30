import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin, of } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { AuthorizationService } from '../../../../../core/authorization/authorization.service';
import { SalesLifecycleFacade } from '../../application/sales-lifecycle.facade';
import {
  SaleDetail,
  SaleFiscalDocument,
  SalePayment,
  SaleReceipt,
  SaleReturn,
} from '../../domain/sales-lifecycle.models';
import { FiscalPanel } from '../fiscal-panel/fiscal-panel';
import { ReceiptDialog } from '../receipt-dialog/receipt-dialog';
import { ReturnDialog } from '../return-dialog/return-dialog';

type DetailView = 'SUMMARY' | 'RETURNS' | 'FISCAL';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe, FiscalPanel, ReactiveFormsModule, ReceiptDialog, ReturnDialog],
  selector: 'ui-sale-lifecycle-detail',
  styleUrls: [
    './sale-detail-panel.scss',
    './sale-detail-sections.scss',
    './sale-detail-responsive.scss',
  ],
  templateUrl: './sale-detail-panel.html',
})
export class SaleDetailPanel implements OnChanges {
  private readonly facade = inject(SalesLifecycleFacade);
  private readonly authorization = inject(AuthorizationService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly actionKeys = new Map<string, string>();

  readonly saleId = input.required<string>();
  readonly closed = output<void>();
  readonly saleChanged = output<void>();

  protected readonly sale = signal<SaleDetail | null>(null);
  protected readonly returns = signal<readonly SaleReturn[]>([]);
  protected readonly fiscal = signal<SaleFiscalDocument | null>(null);
  protected readonly view = signal<DetailView>('SUMMARY');
  protected readonly loading = signal(true);
  protected readonly busyAction = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly receipt = signal<SaleReceipt | null>(null);
  protected readonly returnOpen = signal(false);
  protected readonly voidOpen = signal(false);
  protected readonly settleTarget = signal<SaleReturn | null>(null);

  protected readonly canManage = computed(() => this.authorization.has('SALES_MANAGE'));
  protected readonly canVoid = computed(() => this.authorization.has('SALES_VOID'));
  protected readonly canReturn = computed(() => this.authorization.has('SALES_RETURN'));
  protected readonly canReprint = computed(() => this.authorization.has('SALE_REPRINT'));

  protected readonly voidForm = this.formBuilder.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(240)]],
  });
  protected readonly settlementForm = this.formBuilder.nonNullable.group({
    mode: ['REFUND' as 'REFUND' | 'STORE_CREDIT'],
    originalPaymentId: [''],
    amount: ['', [Validators.required]],
  });

  ngOnChanges(): void {
    this.load(this.saleId());
  }

  protected openReceipt(): void {
    const sale = this.sale();
    if (!sale || this.busyAction()) return;
    this.run('receipt', this.facade.reprintReceipt(sale.id), (receipt) => {
      this.receipt.set(receipt);
      this.notice.set('Se generó una copia auditada del ticket.');
    });
  }

  protected voidSale(): void {
    const sale = this.sale();
    if (!sale || this.voidForm.invalid || this.busyAction()) return;
    const keyName = `void:${sale.id}`;
    this.run(
      'void',
      this.facade.voidSale(
        sale.id,
        this.voidForm.controls.reason.value.trim(),
        this.keyFor(keyName),
      ),
      (updated) => {
        this.actionKeys.delete(keyName);
        this.sale.set(updated);
        this.voidOpen.set(false);
        this.notice.set('Venta anulada. Pagos e inventario fueron revertidos por el servidor.');
        this.saleChanged.emit();
      },
    );
  }

  protected returnCreated(created: SaleReturn): void {
    this.returns.update((items) => [created, ...items]);
    this.returnOpen.set(false);
    this.view.set('RETURNS');
    this.notice.set('Devolución registrada; el ajuste de inventario quedó auditado.');
    this.saleChanged.emit();
  }

  protected openSettlement(item: SaleReturn): void {
    this.settleTarget.set(item);
    this.settlementForm.reset({
      mode: 'REFUND',
      originalPaymentId: this.permittedPayments()[0]?.id ?? '',
      amount: item.refundableAmount,
    });
    this.error.set(null);
  }

  protected settlementModeChanged(): void {
    const target = this.settleTarget();
    if (!target) return;
    const mode = this.settlementForm.controls.mode.value;
    this.settlementForm.controls.originalPaymentId.setValue(
      mode === 'REFUND' ? (this.permittedPayments()[0]?.id ?? '') : '',
    );
    this.settlementForm.controls.amount.setValue(target.refundableAmount);
  }

  protected settle(): void {
    const sale = this.sale();
    const target = this.settleTarget();
    if (!sale || !target || this.settlementForm.invalid || this.busyAction()) return;
    const { mode, originalPaymentId, amount } = this.settlementForm.getRawValue();
    if (mode === 'REFUND' && !this.permittedPayments().some(({ id }) => id === originalPaymentId)) {
      this.error.set('Selecciona un pago original con saldo disponible.');
      return;
    }
    if (mode === 'STORE_CREDIT' && !sale.customer) {
      this.error.set('El crédito en tienda requiere una venta asociada a un cliente.');
      return;
    }
    const keyName = `settle:${target.id}`;
    this.run(
      'settlement',
      this.facade.settleReturn(
        sale.id,
        target.id,
        {
          mode,
          amount: amount.trim(),
          ...(mode === 'REFUND' ? { originalPaymentId } : {}),
        },
        this.keyFor(keyName),
      ),
      (updated) => {
        this.actionKeys.delete(keyName);
        this.returns.update((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        );
        this.settleTarget.set(null);
        this.notice.set('Liquidación registrada contra un medio permitido.');
      },
    );
  }

  protected permittedPayments(): readonly (SalePayment & { readonly remaining: string })[] {
    const sale = this.sale();
    if (!sale) return [];
    return sale.payments.flatMap((payment) => {
      if (payment.status !== 'COMPLETED' || payment.method === 'CREDIT') return [];
      const used = this.returns().reduce(
        (total, returned) =>
          total +
          returned.settlements
            .filter(
              (settlement) =>
                settlement.status === 'COMPLETED' &&
                settlement.mode === 'REFUND' &&
                settlement.originalPayment?.id === payment.id,
            )
            .reduce((sum, settlement) => sum + Number(settlement.amount), 0),
        0,
      );
      const remaining = Math.max(0, Number(payment.amountApplied) - used);
      return remaining > 0 ? [{ ...payment, remaining: remaining.toFixed(2) }] : [];
    });
  }

  protected fiscalChanged(document: SaleFiscalDocument): void {
    this.fiscal.set(document);
  }

  protected childNotice(message: string): void {
    this.error.set(null);
    this.notice.set(message);
  }

  protected childError(message: string): void {
    this.notice.set(null);
    this.error.set(message);
  }

  private load(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.view.set('SUMMARY');
    forkJoin({
      sale: this.facade.getSale(id),
      returns: this.canReturn() ? this.facade.listReturns(id) : of([] as readonly SaleReturn[]),
      fiscal: this.canReprint() ? this.facade.getFiscal(id) : of(null),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ sale, returns, fiscal }) => {
          this.sale.set(sale);
          this.returns.set(returns);
          this.fiscal.set(fiscal);
        },
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  private run<T>(
    action: string,
    operation: import('rxjs').Observable<T>,
    success: (value: T) => void,
  ): void {
    this.busyAction.set(action);
    this.error.set(null);
    this.notice.set(null);
    operation.pipe(finalize(() => this.busyAction.set(null))).subscribe({
      next: success,
      error: (error: unknown) => this.error.set(this.messageFor(error)),
    });
  }

  private keyFor(action: string): string {
    const existing = this.actionKeys.get(action);
    if (existing) return existing;
    const created = `web-${action}-${crypto.randomUUID()}`;
    this.actionKeys.set(action, created);
    return created;
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible completar la operación.';
    const messages: Record<string, string> = {
      SALE_ALREADY_VOIDED: 'La venta ya estaba anulada.',
      SALE_VOID_NOT_ALLOWED: 'La venta ya tiene operaciones que impiden anularla.',
      CASH_REGISTER_SHIFT_REQUIRED: 'Abre un turno de caja para completar esta operación.',
      SALE_RETURN_SETTLEMENT_PAYMENT_INVALID: 'El pago seleccionado no admite este reembolso.',
      SALE_RETURN_SETTLEMENT_AMOUNT_INVALID: 'El importe excede el saldo pendiente.',
      SALE_RETURN_SETTLEMENT_CUSTOMER_REQUIRED: 'El crédito en tienda requiere un cliente.',
      SALE_RETURN_SETTLEMENT_CASH_UNAVAILABLE: 'La caja no tiene efectivo suficiente.',
      FISCAL_DOCUMENT_NOT_FOUND: 'Todavía no existe un documento fiscal para esta venta.',
      IDEMPOTENCY_KEY_REUSED: 'La operación ya fue utilizada con otros datos.',
    };
    return messages[error.code] ?? error.message;
  }
}
