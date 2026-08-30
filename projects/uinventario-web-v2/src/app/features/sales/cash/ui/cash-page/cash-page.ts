import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { AuthorizationService } from '../../../../../core/authorization/authorization.service';
import { SessionState } from '../../../../../core/session/session-state';
import { CashFacade } from '../../application/cash.facade';
import { cashDifference, denominationTotal } from '../../domain/cash-calculations';
import { CashClosure, CashMovement, CashShift } from '../../domain/cash.models';

const OPENING_MONEY = /^(0|[1-9]\d{0,12})(?:\.\d{1,2})?$/;
const POSITIVE_MONEY = /^(?:[1-9]\d{0,12}(?:\.\d{1,2})?|0\.(?:0[1-9]|[1-9]\d?))$/;
const DENOMINATIONS = [
  '1000.00',
  '500.00',
  '200.00',
  '100.00',
  '50.00',
  '20.00',
  '10.00',
  '5.00',
  '2.00',
  '1.00',
  '0.50',
];

type CashDialog = 'movement' | 'reversal' | 'closure' | null;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'ui-cash-page',
  styleUrls: ['./cash-page.scss', './cash-dialog.scss'],
  templateUrl: './cash-page.html',
})
export class CashPage {
  private readonly facade = inject(CashFacade);
  private readonly authorization = inject(AuthorizationService);
  private readonly sessions = inject(SessionState);
  private readonly destroyRef = inject(DestroyRef);
  private readonly forms = new FormBuilder().nonNullable;

  protected readonly shift = signal<CashShift | null>(null);
  protected readonly movements = signal<readonly CashMovement[]>([]);
  protected readonly latestClosure = signal<CashClosure | null>(null);
  protected readonly expectedCash = signal('0.00');
  protected readonly currency = signal('MXN');
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly dialog = signal<CashDialog>(null);
  protected readonly reversing = signal<CashMovement | null>(null);
  protected readonly denominationCounts = signal(DENOMINATIONS.map(() => 0));

  protected readonly context = computed(() => this.sessions.session()?.context ?? null);
  protected readonly canOpen = computed(() => this.authorization.has('CASH_REGISTER_OPEN'));
  protected readonly canMove = computed(() => this.authorization.has('CASH_REGISTER_MOVE'));
  protected readonly canClose = computed(() => this.authorization.has('CASH_REGISTER_CLOSE'));

  protected readonly openingForm = this.forms.group({
    openingAmount: ['', [Validators.required, Validators.pattern(OPENING_MONEY)]],
  });
  protected readonly movementForm = this.forms.group({
    type: ['INCOME' as 'INCOME' | 'WITHDRAWAL', Validators.required],
    amount: ['', [Validators.required, Validators.pattern(POSITIVE_MONEY)]],
    reason: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
  });
  protected readonly reversalForm = this.forms.group({
    reason: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
  });
  protected readonly closureForm = this.forms.group({
    countedAmount: ['', [Validators.required, Validators.pattern(OPENING_MONEY)]],
    differenceReason: ['', Validators.maxLength(160)],
  });

  constructor() {
    this.refresh();
  }

  protected refresh(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ shift: this.facade.currentShift(), closure: this.facade.latestClosure() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ shift, closure }) => {
          this.shift.set(shift);
          this.latestClosure.set(closure);
          if (shift) this.loadMovements();
          else this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(this.messageFor(error, 'No fue posible consultar la caja.'));
          this.loading.set(false);
        },
      });
  }

  protected openShift(): void {
    if (this.openingForm.invalid || !this.canOpen()) {
      this.openingForm.markAllAsTouched();
      return;
    }
    this.runMutation(
      this.facade.openShift(this.openingForm.controls.openingAmount.value),
      (shift) => {
        this.shift.set(shift);
        this.openingForm.reset({ openingAmount: '' });
        this.notice.set('Turno abierto. El POS ya puede cotizar y cobrar.');
        this.loadMovements();
      },
    );
  }

  protected showMovement(type: 'INCOME' | 'WITHDRAWAL'): void {
    this.movementForm.reset({ type, amount: '', reason: '' });
    this.dialog.set('movement');
    this.error.set(null);
  }

  protected createMovement(): void {
    if (this.movementForm.invalid || !this.canMove()) {
      this.movementForm.markAllAsTouched();
      return;
    }
    this.runMutation(this.facade.createMovement(this.movementForm.getRawValue()), () => {
      this.dialog.set(null);
      this.notice.set('Movimiento registrado de forma inmutable.');
      this.loadMovements();
    });
  }

  protected showReversal(movement: CashMovement): void {
    this.reversing.set(movement);
    this.reversalForm.reset({ reason: '' });
    this.dialog.set('reversal');
    this.error.set(null);
  }

  protected reverseMovement(): void {
    const movement = this.reversing();
    if (!movement || this.reversalForm.invalid || !this.canMove()) {
      this.reversalForm.markAllAsTouched();
      return;
    }
    this.runMutation(
      this.facade.reverseMovement(movement.id, this.reversalForm.controls.reason.value),
      () => {
        this.dialog.set(null);
        this.reversing.set(null);
        this.notice.set('Reversa registrada; el movimiento original permanece en el historial.');
        this.loadMovements();
      },
    );
  }

  protected showClosure(): void {
    this.denominationCounts.set(DENOMINATIONS.map(() => 0));
    this.closureForm.reset({ countedAmount: this.expectedCash(), differenceReason: '' });
    this.dialog.set('closure');
    this.error.set(null);
  }

  protected closeShift(): void {
    const countedAmount = this.countedAmount();
    const difference = cashDifference(this.expectedCash(), countedAmount);
    const reason = this.closureForm.controls.differenceReason.value.trim();
    if (
      this.closureForm.invalid ||
      difference === null ||
      (difference !== '0.00' && reason.length < 2) ||
      !this.canClose()
    ) {
      this.closureForm.markAllAsTouched();
      this.error.set(
        difference && difference !== '0.00' && reason.length < 2
          ? 'Explica el sobrante o faltante antes de cerrar.'
          : 'Revisa el efectivo contado.',
      );
      return;
    }
    const denominations = this.activeDenominations();
    this.runMutation(
      this.facade.closeShift({
        countedAmount,
        ...(reason ? { differenceReason: reason } : {}),
        ...(denominations.length ? { denominations } : {}),
      }),
      (closure) => {
        this.latestClosure.set(closure);
        this.shift.set(null);
        this.movements.set([]);
        this.expectedCash.set('0.00');
        this.dialog.set(null);
        this.notice.set('Turno cerrado y reporte de arqueo disponible.');
      },
    );
  }

  protected closeDialog(): void {
    if (this.submitting()) return;
    this.dialog.set(null);
    this.reversing.set(null);
    this.error.set(null);
  }

  protected updateDenomination(index: number, event: Event): void {
    const value = Math.max(0, Number.parseInt((event.target as HTMLInputElement).value || '0', 10));
    this.denominationCounts.update((counts) =>
      counts.map((count, candidate) => (candidate === index ? value : count)),
    );
    const denominations = this.activeDenominations();
    if (denominations.length) {
      this.closureForm.controls.countedAmount.setValue(denominationTotal(denominations));
    }
  }

  protected countedAmount(): string {
    return this.closureForm.controls.countedAmount.value.trim();
  }

  protected difference(): string | null {
    return cashDifference(this.expectedCash(), this.countedAmount());
  }

  protected hasDenominationCount(): boolean {
    return this.denominationCounts().some((quantity) => quantity > 0);
  }

  protected money(value: string, currency = this.currency()): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(Number(value));
  }

  protected date(value: string): string {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value),
    );
  }

  protected movementLabel(movement: CashMovement): string {
    if (movement.type === 'INCOME') return 'Ingreso';
    if (movement.type === 'WITHDRAWAL') return 'Retiro';
    return movement.reversalOf?.type === 'INCOME' ? 'Reversa de ingreso' : 'Reversa de retiro';
  }

  protected denomination(index: number): string {
    return DENOMINATIONS[index];
  }

  private activeDenominations() {
    return this.denominationCounts().flatMap((quantity, index) =>
      quantity > 0 ? [{ denomination: DENOMINATIONS[index], quantity }] : [],
    );
  }

  private loadMovements(): void {
    this.loading.set(true);
    this.facade
      .listMovements()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.movements.set(result.movements);
          this.expectedCash.set(result.expectedCash);
          this.currency.set(result.currency);
        },
        error: (error: unknown) =>
          this.error.set(this.messageFor(error, 'No fue posible consultar los movimientos.')),
      });
  }

  private runMutation<T>(
    request: import('rxjs').Observable<T>,
    complete: (value: T) => void,
  ): void {
    this.submitting.set(true);
    this.error.set(null);
    this.notice.set(null);
    request
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: complete,
        error: (error: unknown) =>
          this.error.set(this.messageFor(error, 'No fue posible completar la operación.')),
      });
  }

  private messageFor(error: unknown, fallback: string): string {
    if (!(error instanceof ApiError)) return fallback;
    const messages: Record<string, string> = {
      CASH_REGISTER_ALREADY_OPEN: 'La caja o este usuario ya tienen un turno abierto.',
      CASH_REGISTER_SHIFT_REQUIRED: 'Abre un turno antes de operar la caja.',
      CASH_REGISTER_MOVEMENT_ALREADY_REVERSED: 'Este movimiento ya fue reversado.',
      INSUFFICIENT_EXPECTED_CASH: 'El retiro dejaría un saldo esperado negativo.',
      CASH_DIFFERENCE_REASON_REQUIRED: 'Explica el sobrante o faltante antes de cerrar.',
      DENOMINATION_TOTAL_MISMATCH: 'El conteo por denominaciones no coincide con el total.',
      CASH_REGISTER_ALREADY_CLOSED: 'El turno ya fue cerrado.',
    };
    return messages[error.code] ?? error.message ?? fallback;
  }
}
