import { ChangeDetectionStrategy, Component, OnInit, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PurchaseOrder, PurchaseTransitionAction } from '../../domain/procurement.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-transition-dialog',
  styleUrl: '../procurement-dialog.scss',
  templateUrl: './transition-dialog.html',
})
export class TransitionDialog implements OnInit {
  readonly order = input.required<PurchaseOrder>();
  readonly action = input.required<PurchaseTransitionAction>();
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  readonly closed = output<void>();
  readonly submitted = output<string | undefined>();
  protected readonly form = new FormBuilder().nonNullable.group({ reason: [''] });

  ngOnInit(): void {
    if (this.action() === 'CANCEL') {
      this.form.controls.reason.addValidators([
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(500),
      ]);
      this.form.controls.reason.updateValueAndValidity();
    }
  }

  protected title(): string {
    return { APPROVE: 'Aprobar orden', SEND: 'Enviar orden', CANCEL: 'Cancelar orden' }[
      this.action()
    ];
  }

  protected description(): string {
    return {
      APPROVE: 'La orden quedará autorizada y lista para enviarse al proveedor.',
      SEND: 'Se registrará el envío mediante el adaptador configurado por el servidor.',
      CANCEL: 'La orden quedará cancelada y no podrá recibir productos.',
    }[this.action()];
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const reason = this.form.controls.reason.value.trim();
    this.submitted.emit(reason || undefined);
  }
}
