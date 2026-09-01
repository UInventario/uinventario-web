import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  input,
  output,
  signal,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { OperationLineInput, OperationOptions, SalesChannel } from '../../domain/operations.models';
import { QuotationInput, SalesQuotation } from '../../domain/quotation.models';
import { ProductReservation } from '../../domain/reservation.models';
import { OperationLinesEditor } from '../operation-lines-editor/operation-lines-editor';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OperationLinesEditor, ReactiveFormsModule],
  selector: 'ui-quotation-editor-dialog',
  styleUrls: ['../operations-dialog.scss'],
  templateUrl: './quotation-editor-dialog.html',
})
export class QuotationEditorDialog implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  readonly options = input.required<OperationOptions>();
  readonly reservations = input.required<readonly ProductReservation[]>();
  readonly quotation = input<SalesQuotation | null>(null);
  readonly busy = input(false);
  readonly apiError = input<string | null>(null);
  readonly cancelled = output<void>();
  readonly submitted = output<{ readonly input: QuotationInput; readonly version?: number }>();

  protected readonly lines = signal<readonly OperationLineInput[]>([
    { productId: '', quantity: '1' },
  ]);
  protected readonly error = signal<string | null>(null);
  protected readonly form = this.formBuilder.nonNullable.group({
    customerId: '',
    reservationId: '',
    channel: 'WEB' as SalesChannel,
    validUntil: localDate(new Date(Date.now() + 86_400_000).toISOString()),
    notes: '',
  });

  ngOnInit(): void {
    const quotation = this.quotation();
    if (!quotation) return;
    this.form.setValue({
      customerId: quotation.customer?.id ?? '',
      reservationId: quotation.reservation?.id ?? '',
      channel: quotation.channel,
      validUntil: localDate(quotation.validUntil),
      notes: quotation.notes ?? '',
    });
    this.lines.set(
      quotation.lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
    );
  }

  protected reservationChanged(): void {
    const reservation = this.reservations().find(
      ({ id }) => id === this.form.controls.reservationId.value,
    );
    if (!reservation) return;
    this.form.controls.customerId.setValue(reservation.customer.id);
    this.lines.set(
      reservation.lines.map((line) => ({
        productId: line.product.id,
        quantity: line.quantity,
        ...(line.serialNumbers.length ? { serialNumbers: line.serialNumbers } : {}),
      })),
    );
  }

  protected submit(): void {
    const value = this.form.getRawValue();
    const validUntil = new Date(value.validUntil);
    if (!validLines(this.lines())) {
      this.error.set('Completa productos únicos y cantidades válidas.');
      return;
    }
    if (!Number.isFinite(validUntil.getTime()) || validUntil.getTime() <= Date.now()) {
      this.error.set('La vigencia debe ser posterior al momento actual.');
      return;
    }
    const current = this.quotation();
    this.submitted.emit({
      input: {
        ...(value.customerId ? { customerId: value.customerId } : {}),
        ...(value.reservationId ? { reservationId: value.reservationId } : {}),
        channel: value.channel,
        validUntil: validUntil.toISOString(),
        ...(value.notes.trim() ? { notes: value.notes.trim() } : {}),
        lines: this.lines(),
      },
      ...(current ? { version: current.version } : {}),
    });
  }
}

function validLines(lines: readonly OperationLineInput[]): boolean {
  const products = lines.map(({ productId }) => productId);
  return (
    Boolean(lines.length) &&
    products.every(Boolean) &&
    new Set(products).size === products.length &&
    lines.every(({ quantity }) =>
      /^(?:[1-9]\d{0,8}(?:\.\d{1,3})?|0\.(?:00[1-9]|0[1-9]\d?|[1-9]\d{0,2}))$/.test(quantity),
    )
  );
}

function localDate(value: string): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
