import { ChangeDetectionStrategy, Component, OnInit, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PosCartLine } from '../../domain/pos.models';
import { normalizeQuantity } from '../../domain/quantity';

const MONEY_PATTERN = /^(?:[1-9]\d{0,11}(?:\.\d{1,2})?|0\.(?:0[1-9]|[1-9]\d?))$/;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-pos-line-dialog',
  styleUrl: './pos-line-dialog.scss',
  templateUrl: './pos-line-dialog.html',
})
export class PosLineDialog implements OnInit {
  readonly line = input.required<PosCartLine>();
  readonly canOverridePrice = input(false);
  readonly closed = output<void>();
  readonly submitted = output<PosCartLine>();

  protected readonly error = signal<string | null>(null);
  protected readonly form = new FormBuilder().nonNullable.group({
    quantity: ['', Validators.required],
    note: ['', Validators.maxLength(240)],
    manualUnitPrice: ['', Validators.pattern(MONEY_PATTERN)],
    priceOverrideReason: ['', Validators.maxLength(240)],
  });

  ngOnInit(): void {
    const line = this.line();
    this.form.reset({
      quantity: line.quantity,
      note: line.note ?? '',
      manualUnitPrice: this.canOverridePrice() ? (line.manualUnitPrice ?? '') : '',
      priceOverrideReason: this.canOverridePrice() ? (line.priceOverrideReason ?? '') : '',
    });
  }

  protected submit(): void {
    const value = this.form.getRawValue();
    const quantity = normalizeQuantity(value.quantity, this.line().product);
    if (!quantity) {
      this.error.set(
        `Usa una cantidad mínima de ${this.line().product.minimumQuantity} con hasta ${this.line().product.quantityPrecision} decimales.`,
      );
      return;
    }
    if (
      this.form.invalid ||
      (this.canOverridePrice() &&
        value.manualUnitPrice &&
        value.priceOverrideReason.trim().length < 3)
    ) {
      this.form.markAllAsTouched();
      this.error.set('Revisa la cantidad, precio y motivo del cambio.');
      return;
    }
    const note = value.note.trim();
    const manualUnitPrice = this.canOverridePrice() ? value.manualUnitPrice.trim() : '';
    const priceOverrideReason = this.canOverridePrice() ? value.priceOverrideReason.trim() : '';
    this.submitted.emit({
      product: this.line().product,
      quantity,
      ...(note ? { note } : {}),
      ...(manualUnitPrice ? { manualUnitPrice, priceOverrideReason } : {}),
    });
  }
}
