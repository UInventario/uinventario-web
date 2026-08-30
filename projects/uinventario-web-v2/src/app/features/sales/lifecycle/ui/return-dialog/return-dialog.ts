import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { SalesLifecycleFacade } from '../../application/sales-lifecycle.facade';
import { SaleDetail, SaleLine, SaleReturn } from '../../domain/sales-lifecycle.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-sale-return-dialog',
  styleUrl: './return-dialog.scss',
  templateUrl: './return-dialog.html',
})
export class ReturnDialog {
  private readonly facade = inject(SalesLifecycleFacade);
  private readonly formBuilder = inject(FormBuilder);
  private readonly idempotencyKey = `web-return-${crypto.randomUUID()}`;

  readonly sale = input.required<SaleDetail>();
  readonly returns = input.required<readonly SaleReturn[]>();
  readonly closed = output<void>();
  readonly created = output<SaleReturn>();

  protected readonly form = this.formBuilder.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(240)]],
    exchangeSaleId: [''],
  });
  protected readonly quantities = signal<Record<string, string>>({});
  protected readonly conditions = signal<Record<string, 'SELLABLE' | 'DAMAGED'>>({});
  protected readonly serials = signal<Record<string, string>>({});
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly selectedCount = computed(
    () => this.sale().lines.filter((line) => Number(this.quantities()[line.id] ?? 0) > 0).length,
  );

  protected remaining(line: SaleLine): number {
    const returned = this.returns().reduce(
      (sum, item) =>
        sum +
        item.lines
          .filter((candidate) => candidate.saleLineId === line.id)
          .reduce((lineSum, candidate) => lineSum + Number(candidate.quantity), 0),
      0,
    );
    return Math.max(0, Number(line.quantity) - returned);
  }

  protected setQuantity(line: SaleLine, value: string): void {
    this.quantities.update((current) => ({ ...current, [line.id]: value }));
  }

  protected setCondition(line: SaleLine, value: string): void {
    this.conditions.update((current) => ({
      ...current,
      [line.id]: value === 'DAMAGED' ? 'DAMAGED' : 'SELLABLE',
    }));
  }

  protected setSerials(line: SaleLine, value: string): void {
    this.serials.update((current) => ({ ...current, [line.id]: value }));
  }

  protected submit(): void {
    if (this.busy() || this.form.invalid) return;
    this.error.set(null);
    const lines = this.sale().lines.flatMap((line) => {
      const quantity = this.quantities()[line.id]?.trim() ?? '';
      const numeric = Number(quantity);
      if (!quantity || numeric <= 0) return [];
      if (!Number.isFinite(numeric) || numeric > this.remaining(line)) {
        this.error.set(`La cantidad de ${line.product.name} supera lo disponible para devolver.`);
        return [];
      }
      const serialNumbers = (this.serials()[line.id] ?? '')
        .split(/[\n,]/)
        .map((value) => value.trim())
        .filter(Boolean);
      return [
        {
          saleLineId: line.id,
          quantity,
          condition: this.conditions()[line.id] ?? ('SELLABLE' as const),
          ...(serialNumbers.length ? { serialNumbers } : {}),
        },
      ];
    });
    if (!lines.length || lines.length !== this.selectedCount()) {
      if (!this.error()) this.error.set('Selecciona al menos una cantidad válida para devolver.');
      return;
    }
    this.busy.set(true);
    const { reason, exchangeSaleId } = this.form.getRawValue();
    this.facade
      .createReturn(
        this.sale().id,
        {
          reason: reason.trim(),
          ...(exchangeSaleId.trim() ? { exchangeSaleId: exchangeSaleId.trim() } : {}),
          lines,
        },
        this.idempotencyKey,
      )
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (created) => this.created.emit(created),
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible registrar la devolución.';
    const messages: Record<string, string> = {
      SALE_RETURN_QUANTITY_INVALID: 'Una cantidad excede lo pendiente por devolver.',
      SALE_RETURN_NOT_ALLOWED: 'Esta venta no admite devoluciones en su estado actual.',
      SALE_RETURN_SERIAL_INVALID: 'Verifica las series capturadas para los productos devueltos.',
      SALE_RETURN_EXCHANGE_INVALID: 'La venta de cambio no es válida o ya fue relacionada.',
      IDEMPOTENCY_KEY_REUSED: 'La operación ya fue utilizada con otros datos.',
    };
    return messages[error.code] ?? error.message;
  }
}
