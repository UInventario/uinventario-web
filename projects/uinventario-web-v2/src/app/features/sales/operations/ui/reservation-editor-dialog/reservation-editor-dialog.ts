import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { OperationLineInput, OperationOptions } from '../../domain/operations.models';
import { CreateReservationInput } from '../../domain/reservation.models';
import { OperationLinesEditor } from '../operation-lines-editor/operation-lines-editor';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OperationLinesEditor, ReactiveFormsModule],
  selector: 'ui-reservation-editor-dialog',
  styleUrls: ['../operations-dialog.scss'],
  templateUrl: './reservation-editor-dialog.html',
})
export class ReservationEditorDialog {
  private readonly formBuilder = inject(FormBuilder);
  readonly options = input.required<OperationOptions>();
  readonly busy = input(false);
  readonly apiError = input<string | null>(null);
  readonly cancelled = output<void>();
  readonly submitted = output<CreateReservationInput>();
  protected readonly lines = signal<readonly OperationLineInput[]>([
    { productId: '', quantity: '1' },
  ]);
  protected readonly error = signal<string | null>(null);
  protected readonly form = this.formBuilder.nonNullable.group({
    customerId: '',
    locationId: '',
    expiresInHours: 24,
  });

  protected submit(): void {
    const value = this.form.getRawValue();
    const products = this.lines().map(({ productId }) => productId);
    if (!value.customerId || !value.locationId) {
      this.error.set('Selecciona cliente y ubicación.');
      return;
    }
    if (
      !this.lines().length ||
      products.some((id) => !id) ||
      new Set(products).size !== products.length ||
      this.lines().some(
        ({ quantity }) =>
          !/^(?:[1-9]\d{0,8}(?:\.\d{1,3})?|0\.(?:00[1-9]|0[1-9]\d?|[1-9]\d{0,2}))$/.test(quantity),
      )
    ) {
      this.error.set('Completa productos únicos y cantidades válidas.');
      return;
    }
    if (value.expiresInHours < 1 || value.expiresInHours > 720) {
      this.error.set('La reserva debe durar entre 1 y 720 horas.');
      return;
    }
    this.submitted.emit({ ...value, lines: this.lines() });
  }
}
