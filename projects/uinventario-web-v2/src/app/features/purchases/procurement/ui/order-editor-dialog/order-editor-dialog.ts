import { ChangeDetectionStrategy, Component, OnInit, input, output, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  PurchaseOrder,
  PurchaseOrderInput,
  SupplierOption,
  SupplierProductOption,
} from '../../domain/procurement.models';

type LineForm = FormGroup<{
  supplierProductId: FormControl<string>;
  quantity: FormControl<string>;
  unitCost: FormControl<string>;
  notes: FormControl<string>;
}>;

const quantityPattern = /^(?:[1-9]\d{0,11}(?:\.\d{1,3})?|0\.(?:00[1-9]|0[1-9]\d?|[1-9]\d{0,2}))$/;
const costPattern = /^(?:[1-9]\d{0,11}(?:\.\d{1,2})?|0\.(?:0[1-9]|[1-9]\d?))$/;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-order-editor-dialog',
  styleUrl: '../procurement-dialog.scss',
  templateUrl: './order-editor-dialog.html',
})
export class OrderEditorDialog implements OnInit {
  readonly order = input<PurchaseOrder | null>(null);
  readonly suppliers = input.required<readonly SupplierOption[]>();
  readonly products = input.required<readonly SupplierProductOption[]>();
  readonly productsLoading = input(false);
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  readonly closed = output<void>();
  readonly supplierChanged = output<string>();
  readonly submitted = output<PurchaseOrderInput>();
  protected readonly localError = signal<string | null>(null);
  private readonly formBuilder = new FormBuilder();
  protected readonly form = this.formBuilder.nonNullable.group({
    supplierId: ['', Validators.required],
    currency: ['MXN', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
    notes: ['', Validators.maxLength(1000)],
    lines: this.formBuilder.array<LineForm>([]),
  });

  protected get lines(): FormArray<LineForm> {
    return this.form.controls.lines;
  }

  ngOnInit(): void {
    const order = this.order();
    this.form.patchValue({
      supplierId: order?.supplier.id ?? '',
      currency: order?.currency ?? 'MXN',
      notes: order?.notes ?? '',
    });
    for (const line of order?.lines ?? []) {
      this.addLine({
        supplierProductId: line.supplierProductId,
        quantity: line.quantity,
        unitCost: line.unitCost,
        notes: line.notes ?? '',
      });
    }
    if (!this.lines.length) this.addLine();
  }

  protected changeSupplier(): void {
    const supplierId = this.form.controls.supplierId.value;
    this.lines.controls.forEach((line) => {
      line.controls.supplierProductId.setValue('');
      line.controls.unitCost.setValue('');
    });
    this.supplierChanged.emit(supplierId);
  }

  protected addLine(value?: {
    supplierProductId: string;
    quantity: string;
    unitCost: string;
    notes: string;
  }): void {
    if (this.lines.length >= 100) return;
    this.lines.push(
      this.formBuilder.nonNullable.group({
        supplierProductId: [value?.supplierProductId ?? '', Validators.required],
        quantity: [
          value?.quantity ?? '',
          [Validators.required, Validators.pattern(quantityPattern)],
        ],
        unitCost: [value?.unitCost ?? '', [Validators.required, Validators.pattern(costPattern)]],
        notes: [value?.notes ?? '', Validators.maxLength(500)],
      }),
    );
  }

  protected removeLine(index: number): void {
    if (this.lines.length > 1) this.lines.removeAt(index);
  }

  protected selectProduct(index: number): void {
    const line = this.lines.at(index);
    const product = this.products().find(
      (candidate) => candidate.id === line.controls.supplierProductId.value,
    );
    const price = product?.prices[0];
    if (!price) return;
    line.controls.unitCost.setValue(price.unitCost);
    if (!line.controls.quantity.value) {
      line.controls.quantity.setValue(product.minimumQuantity || '1');
    }
    this.form.controls.currency.setValue(price.currency);
  }

  protected submit(): void {
    this.localError.set(null);
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const productIds = value.lines.map((line) => line.supplierProductId);
    if (new Set(productIds).size !== productIds.length) {
      this.localError.set('Cada producto del proveedor sólo puede aparecer una vez.');
      return;
    }
    this.submitted.emit({
      supplierId: value.supplierId,
      currency: value.currency.trim().toUpperCase(),
      notes: value.notes.trim() || undefined,
      lines: value.lines.map((line) => ({
        supplierProductId: line.supplierProductId,
        quantity: line.quantity.trim(),
        unitCost: line.unitCost.trim(),
        notes: line.notes.trim() || undefined,
      })),
    });
  }
}
