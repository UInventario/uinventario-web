import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ProductReservation } from '../../domain/reservation.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-reservation-release-dialog',
  styleUrls: ['../operations-dialog.scss'],
  templateUrl: './reservation-release-dialog.html',
})
export class ReservationReleaseDialog {
  private readonly formBuilder = inject(FormBuilder);
  readonly reservation = input.required<ProductReservation>();
  readonly busy = input(false);
  readonly cancelled = output<void>();
  readonly submitted = output<string>();
  protected readonly error = signal<string | null>(null);
  protected readonly form = this.formBuilder.nonNullable.group({ reason: '' });

  protected submit(): void {
    const reason = this.form.controls.reason.value.replace(/\s+/g, ' ').trim();
    if (reason.length < 3) {
      this.error.set('Indica un motivo de al menos 3 caracteres.');
      return;
    }
    this.submitted.emit(reason);
  }
}
