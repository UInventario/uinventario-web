import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { PaymentMethod } from '../../domain/operations.models';
import {
  ConvertQuotationInput,
  QuotationDifference,
  QuotationPreview,
} from '../../domain/quotation.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-quotation-convert-dialog',
  styleUrls: ['../operations-dialog.scss', './quotation-convert-dialog.scss'],
  templateUrl: './quotation-convert-dialog.html',
})
export class QuotationConvertDialog {
  private readonly formBuilder = inject(FormBuilder);
  readonly preview = input.required<QuotationPreview>();
  readonly paymentMethods = input.required<readonly PaymentMethod[]>();
  readonly busy = input(false);
  readonly apiError = input<string | null>(null);
  readonly cancelled = output<void>();
  readonly submitted = output<ConvertQuotationInput>();
  protected readonly error = signal<string | null>(null);
  protected readonly form = this.formBuilder.nonNullable.group({
    acceptDifferences: false,
    method: 'CASH' as PaymentMethod,
    amountReceived: '',
    reference: '',
  });

  protected submit(): void {
    const preview = this.preview();
    const value = this.form.getRawValue();
    if (!preview.canConvert) {
      this.error.set('La cotización no puede convertirse por falta de disponibilidad.');
      return;
    }
    if (preview.differences.length && !value.acceptDifferences) {
      this.error.set('Confirma que revisaste las diferencias actuales.');
      return;
    }
    if (
      value.method === 'CASH' &&
      Number(value.amountReceived) < Number(preview.recalculated.totals.total)
    ) {
      this.error.set('El efectivo recibido debe cubrir el total actual.');
      return;
    }
    if (value.method !== 'CASH' && value.reference.trim().length < 4) {
      this.error.set('Indica una referencia de pago válida.');
      return;
    }
    this.submitted.emit({
      version: preview.quotation.version,
      acceptDifferences: preview.differences.length > 0,
      payments: [
        value.method === 'CASH'
          ? { method: value.method, amountReceived: value.amountReceived }
          : { method: value.method, reference: value.reference.trim() },
      ],
    });
  }

  protected differenceLabel(difference: QuotationDifference): string {
    return { UNIT_PRICE: 'Precio unitario', AVAILABLE_STOCK: 'Stock disponible', TOTAL: 'Total' }[
      difference.field
    ];
  }
}
