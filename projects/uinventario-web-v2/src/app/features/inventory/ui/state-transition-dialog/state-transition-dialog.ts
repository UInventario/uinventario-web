import { ChangeDetectionStrategy, Component, OnInit, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  InventoryLocation,
  InventoryProductDetails,
  InventoryStateTransitionInput,
  InventoryStockState,
} from '../../domain/inventory.models';

const QUANTITY_PATTERN = /^(0|[1-9]\d{0,11})(\.\d{1,3})?$/;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-inventory-state-transition-dialog',
  styleUrl: '../movement-dialog/movement-dialog.scss',
  templateUrl: './state-transition-dialog.html',
})
export class InventoryStateTransitionDialog implements OnInit {
  readonly product = input.required<InventoryProductDetails>();
  readonly locations = input.required<readonly InventoryLocation[]>();
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  readonly closed = output<void>();
  readonly submitted = output<InventoryStateTransitionInput>();

  protected readonly states: readonly { value: InventoryStockState; label: string }[] = [
    { value: 'AVAILABLE', label: 'Disponible' },
    { value: 'RESERVED', label: 'Reservado' },
    { value: 'DAMAGED', label: 'Dañado' },
    { value: 'IN_TRANSIT', label: 'En tránsito' },
  ];
  protected readonly form = new FormBuilder().nonNullable.group({
    locationId: ['', Validators.required],
    fromState: ['AVAILABLE' as InventoryStockState, Validators.required],
    toState: ['RESERVED' as InventoryStockState, Validators.required],
    quantity: ['', [Validators.required, Validators.pattern(QUANTITY_PATTERN)]],
    reason: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
    reference: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    serialNumbers: [''],
  });

  ngOnInit(): void {
    const firstLocation = this.locations()[0];
    if (firstLocation) this.form.controls.locationId.setValue(firstLocation.id);
  }

  protected submit(): void {
    const value = this.form.getRawValue();
    if (value.fromState === value.toState)
      this.form.controls.toState.setErrors({ sameState: true });
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const serialNumbers = value.serialNumbers
      .split(/[\n,]/)
      .map((serial) => serial.trim())
      .filter(Boolean);
    this.submitted.emit({
      productId: this.product().id,
      locationId: value.locationId,
      fromState: value.fromState,
      toState: value.toState,
      quantity: value.quantity,
      reason: value.reason.trim(),
      reference: value.reference.trim(),
      serialNumbers: serialNumbers.length ? serialNumbers : undefined,
    });
  }
}
