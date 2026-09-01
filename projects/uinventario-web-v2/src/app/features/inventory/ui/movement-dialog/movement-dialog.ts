import { ChangeDetectionStrategy, Component, OnInit, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  InventoryLocation,
  InventoryMovementInput,
  InventoryProductDetails,
  UserInventoryMovementType,
} from '../../domain/inventory.models';

const QUANTITY_PATTERN = /^-?(0|[1-9]\d{0,11})(\.\d{1,3})?$/;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-inventory-movement-dialog',
  styleUrl: './movement-dialog.scss',
  templateUrl: './movement-dialog.html',
})
export class InventoryMovementDialog implements OnInit {
  readonly product = input.required<InventoryProductDetails>();
  readonly locations = input.required<readonly InventoryLocation[]>();
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  readonly closed = output<void>();
  readonly submitted = output<InventoryMovementInput>();

  protected readonly movementTypes: readonly {
    value: UserInventoryMovementType;
    label: string;
  }[] = [
    { value: 'INITIAL', label: 'Stock inicial' },
    { value: 'ENTRY', label: 'Entrada' },
    { value: 'EXIT', label: 'Salida' },
    { value: 'RETURN', label: 'Devolución a inventario' },
    { value: 'LOSS', label: 'Pérdida' },
    { value: 'DAMAGE', label: 'Daño' },
    { value: 'ADJUSTMENT', label: 'Ajuste (+ / -)' },
  ];
  protected readonly form = new FormBuilder().nonNullable.group({
    locationId: ['', Validators.required],
    type: ['ENTRY' as UserInventoryMovementType, Validators.required],
    quantity: ['', [Validators.required, Validators.pattern(QUANTITY_PATTERN)]],
    reason: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
    reference: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    lotCode: [''],
    manufacturedOn: [''],
    expiresOn: [''],
    serialNumbers: [''],
  });

  ngOnInit(): void {
    const firstLocation = this.locations()[0];
    if (firstLocation) this.form.controls.locationId.setValue(firstLocation.id);
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const serialNumbers = value.serialNumbers
      .split(/[\n,]/)
      .map((serial) => serial.trim())
      .filter(Boolean);
    this.submitted.emit({
      productId: this.product().id,
      locationId: value.locationId,
      type: value.type,
      quantity: value.quantity,
      reason: value.reason.trim(),
      reference: value.reference.trim(),
      lotCode: value.lotCode.trim() || undefined,
      manufacturedOn: value.manufacturedOn || undefined,
      expiresOn: value.expiresOn || undefined,
      serialNumbers: serialNumbers.length ? serialNumbers : undefined,
    });
  }
}
