import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { PosFacade } from '../../application/pos.facade';
import { PosCartRequest, PosSuspendedSale } from '../../domain/pos.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-pos-suspend-dialog',
  styleUrl: './pos-suspend-dialog.scss',
  templateUrl: './pos-suspend-dialog.html',
})
export class PosSuspendDialog {
  private readonly facade = inject(PosFacade);
  private readonly formBuilder = inject(FormBuilder);
  private readonly idempotencyKey = `web-suspend-${crypto.randomUUID()}`;

  readonly request = input.required<PosCartRequest>();
  readonly closed = output<void>();
  readonly completed = output<PosSuspendedSale>();

  protected readonly form = this.formBuilder.nonNullable.group({
    notes: ['', [Validators.maxLength(500)]],
  });
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.busy() || this.form.invalid) return;
    this.busy.set(true);
    this.error.set(null);
    const notes = this.form.controls.notes.value.trim();
    const request = this.request();
    this.facade
      .suspendSale(
        {
          lines: request.lines,
          ...(request.customerId ? { customerId: request.customerId } : {}),
          ...(notes ? { notes } : {}),
        },
        this.idempotencyKey,
      )
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (sale) => this.completed.emit(sale),
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected close(): void {
    if (!this.busy()) this.closed.emit();
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible suspender la venta.';
    const messages: Record<string, string> = {
      SUSPENDED_SALE_LINE_CONTROLS_NOT_SUPPORTED:
        'Quita notas y precios manuales antes de suspender esta venta.',
      INSUFFICIENT_STOCK: 'El inventario cambió y ya no alcanza para guardar la venta.',
      CASH_REGISTER_SHIFT_REQUIRED: 'Abre un turno antes de suspender la venta.',
      IDEMPOTENCY_KEY_REUSED: 'La operación ya fue utilizada con otros datos.',
    };
    return messages[error.code] ?? error.message;
  }
}
