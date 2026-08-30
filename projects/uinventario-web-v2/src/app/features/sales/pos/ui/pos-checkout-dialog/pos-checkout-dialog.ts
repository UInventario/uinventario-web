import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { PosFacade } from '../../application/pos.facade';
import { changeFor, isReference, splitPayment, toCents } from '../../domain/money';
import {
  PaymentTerminalOperation,
  PaymentTerminalScenario,
  PosCartQuote,
  PosCartRequest,
  PosCustomer,
  PosPaymentMethod,
  PosPaymentOptions,
  PosSale,
} from '../../domain/pos.models';

type CheckoutFlow = 'CASH' | 'MIXED' | 'TERMINAL' | 'TRANSFER' | 'CREDIT';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-pos-checkout-dialog',
  styleUrls: [
    './pos-checkout-dialog.scss',
    './pos-checkout-methods.scss',
    './pos-checkout-responsive.scss',
  ],
  templateUrl: './pos-checkout-dialog.html',
})
export class PosCheckoutDialog implements OnInit {
  private readonly facade = inject(PosFacade);
  private readonly formBuilder = inject(FormBuilder);

  readonly quote = input.required<PosCartQuote>();
  readonly request = input.required<PosCartRequest>();
  readonly canCredit = input(false);
  readonly closed = output<void>();
  readonly completed = output<PosSale>();

  protected readonly flow = signal<CheckoutFlow>('CASH');
  protected readonly options = signal<PosPaymentOptions | null>(null);
  protected readonly loadingOptions = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sale = signal<PosSale | null>(null);
  protected readonly customers = signal<readonly PosCustomer[]>([]);
  protected readonly searchingCustomers = signal(false);
  protected readonly selectedCustomer = signal<PosCustomer | null>(null);
  protected readonly terminal = signal<PaymentTerminalOperation | null>(null);

  protected readonly cashForm = this.formBuilder.nonNullable.group({ received: [''] });
  protected readonly transferForm = this.formBuilder.nonNullable.group({
    reference: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(120)]],
  });
  protected readonly mixedForm = this.formBuilder.nonNullable.group({
    cashAmount: [''],
    cashReceived: [''],
    otherMethod: ['CARD' as Exclude<PosPaymentMethod, 'CASH'>],
    reference: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(120)]],
  });
  protected readonly terminalForm = this.formBuilder.nonNullable.group({
    scenario: ['SUCCESS' as PaymentTerminalScenario],
  });
  protected readonly creditForm = this.formBuilder.nonNullable.group({
    query: [''],
    installments: [1, [Validators.required, Validators.min(1), Validators.max(36)]],
  });
  private readonly cashReceived = toSignal(this.cashForm.controls.received.valueChanges, {
    initialValue: '',
  });
  private readonly mixedCashAmount = toSignal(this.mixedForm.controls.cashAmount.valueChanges, {
    initialValue: '',
  });
  private readonly mixedCashReceived = toSignal(this.mixedForm.controls.cashReceived.valueChanges, {
    initialValue: '',
  });
  private readonly installments = toSignal(this.creditForm.controls.installments.valueChanges, {
    initialValue: 1,
  });

  protected readonly total = computed(
    () => this.quote().totals.payable ?? this.quote().totals.total,
  );
  protected readonly cashChange = computed(() => changeFor(this.total(), this.cashReceived()));
  protected readonly mixedParts = computed(() =>
    splitPayment(this.total(), this.mixedCashAmount()),
  );
  protected readonly mixedChange = computed(() => {
    const parts = this.mixedParts();
    return parts ? changeFor(parts.cash, this.mixedCashReceived()) : null;
  });
  protected readonly unresolvedTerminal = computed(() =>
    ['PENDING', 'AUTHORIZED', 'INDETERMINATE', 'CAPTURED'].includes(this.terminal()?.status ?? ''),
  );
  protected readonly creditAllowed = computed(() => {
    const customer = this.selectedCustomer();
    const credit = customer?.credit;
    const total = toCents(this.total());
    const available = toCents(credit?.available ?? '');
    return Boolean(
      customer?.active &&
      customer.privacyStatus === 'ACTIVE' &&
      credit?.enabled &&
      credit.status === 'AVAILABLE' &&
      total !== null &&
      available !== null &&
      available >= total &&
      this.installments() <= credit.maxInstallments,
    );
  });

  ngOnInit(): void {
    this.cashForm.controls.received.setValue(this.total());
    this.mixedForm.controls.cashAmount.setValue('');
    this.mixedForm.controls.cashReceived.setValue('');
    this.facade
      .paymentOptions()
      .pipe(finalize(() => this.loadingOptions.set(false)))
      .subscribe({
        next: (options) => this.options.set(options),
        error: (error: unknown) => {
          this.options.set({ methods: [], nonCashProvider: 'UNAVAILABLE' });
          this.error.set(this.messageFor(error));
        },
      });
  }

  protected selectFlow(flow: CheckoutFlow): void {
    if (this.busy() || this.unresolvedTerminal()) return;
    this.flow.set(flow);
    this.error.set(null);
  }

  protected available(method: PosPaymentMethod): boolean {
    return this.options()?.methods.includes(method) ?? false;
  }

  protected close(): void {
    if (!this.busy() && !this.unresolvedTerminal()) this.closed.emit();
  }

  protected submitCash(): void {
    if (!this.available('CASH')) {
      this.error.set('El pago en efectivo no está habilitado.');
      return;
    }
    if (this.cashChange() === null) {
      this.error.set('El efectivo recibido debe cubrir el total de la venta.');
      return;
    }
    const received = this.cashForm.controls.received.value.trim();
    const resumed = this.request().suspendedSaleId;
    this.runSale(
      resumed
        ? this.facade.createSale({
            ...this.request(),
            payment: { method: 'CASH', amount: this.total(), amountReceived: received },
          })
        : this.facade.createCashSale({ ...this.request(), cashReceived: received }),
    );
  }

  protected submitTransfer(): void {
    const reference = this.transferForm.controls.reference.value.trim();
    if (!isReference(reference)) {
      this.error.set('Captura una referencia válida de al menos 4 caracteres.');
      return;
    }
    this.runSale(
      this.facade.createSale({
        ...this.request(),
        payment: { method: 'TRANSFER', amount: this.total(), reference },
      }),
    );
  }

  protected submitMixed(): void {
    const parts = this.mixedParts();
    const received = this.mixedForm.controls.cashReceived.value.trim();
    const reference = this.mixedForm.controls.reference.value.trim();
    if (!parts || this.mixedChange() === null || !isReference(reference)) {
      this.error.set(
        'Indica dos importes que cuadren el total, efectivo suficiente y una referencia válida.',
      );
      return;
    }
    const method = this.mixedForm.controls.otherMethod.value;
    if (!this.available(method)) {
      this.error.set('El segundo método de pago no está habilitado.');
      return;
    }
    this.runSale(
      this.facade.createSale({
        ...this.request(),
        payments: [
          { method: 'CASH', amount: parts.cash, amountReceived: received },
          { method, amount: parts.remainder, reference },
        ],
      }),
    );
  }

  protected startTerminal(): void {
    if (this.busy() || !this.available('CARD')) return;
    this.busy.set(true);
    this.error.set(null);
    this.facade
      .startTerminal({
        amount: this.total(),
        currency: this.quote().currency,
        scenario: this.terminalForm.controls.scenario.value,
      })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (operation) => this.terminal.set(operation),
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected refreshTerminal(): void {
    const operation = this.terminal();
    if (!operation || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.facade
      .getTerminal(operation.id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (current) => this.terminal.set(current),
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected cancelTerminal(): void {
    const operation = this.terminal();
    if (!operation || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.facade
      .cancelTerminal(operation.id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (current) => this.terminal.set(current),
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected completeTerminalSale(): void {
    const operation = this.terminal();
    if (operation?.status !== 'CAPTURED') return;
    this.runSale(
      this.facade.createSale({
        ...this.request(),
        payment: {
          method: 'CARD',
          amount: this.total(),
          terminalOperationId: operation.id,
        },
      }),
    );
  }

  protected searchCustomers(): void {
    const query = this.creditForm.controls.query.value.trim();
    if (query.length < 2 || this.searchingCustomers()) return;
    this.searchingCustomers.set(true);
    this.error.set(null);
    this.facade
      .searchCustomers(query)
      .pipe(finalize(() => this.searchingCustomers.set(false)))
      .subscribe({
        next: ({ customers }) => this.customers.set(customers),
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected selectCustomer(customer: PosCustomer): void {
    this.selectedCustomer.set(customer);
    this.creditForm.controls.installments.setValue(1);
    this.error.set(null);
  }

  protected submitCredit(): void {
    const customer = this.selectedCustomer();
    if (!customer || !this.creditAllowed()) {
      this.error.set('El cliente no tiene crédito suficiente o disponible para esta venta.');
      return;
    }
    this.runSale(
      this.facade.createSale({
        ...this.request(),
        customerId: customer.id,
        credit: { installmentCount: this.creditForm.controls.installments.value },
      }),
    );
  }

  protected money(value: string): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: this.quote().currency,
    }).format(Number(value));
  }

  private runSale(request: ReturnType<PosFacade['createSale']>): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    request.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (sale) => {
        if (sale.status !== 'COMPLETED') {
          this.error.set('La API no confirmó la venta. El carrito permanece intacto.');
          return;
        }
        this.sale.set(sale);
        this.completed.emit(sale);
      },
      error: (error: unknown) => this.error.set(this.messageFor(error)),
    });
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible procesar el pago.';
    const messages: Record<string, string> = {
      PAYMENT_DECLINED: 'El pago fue rechazado. La venta no se registró.',
      PAYMENT_TOTAL_MISMATCH: 'Los pagos no coinciden exactamente con el total.',
      PAYMENT_REFERENCE_REUSED: 'La referencia ya fue utilizada en otra venta.',
      PAYMENT_TERMINAL_NOT_CAPTURED: 'El terminal todavía no confirma el cobro.',
      PAYMENT_TERMINAL_ALREADY_USED: 'Esta operación del terminal ya fue utilizada.',
      CUSTOMER_CREDIT_NOT_AVAILABLE: 'El crédito del cliente no está disponible.',
      CUSTOMER_CREDIT_LIMIT_EXCEEDED: 'La venta excede el crédito disponible.',
      POS_CUSTOMER_NOT_AVAILABLE: 'El cliente ya no está disponible.',
      INSUFFICIENT_STOCK: 'El inventario cambió y ya no alcanza para esta venta.',
      CASH_REGISTER_SHIFT_REQUIRED: 'El turno de caja ya no está abierto.',
    };
    return messages[error.code] ?? error.message;
  }
}
