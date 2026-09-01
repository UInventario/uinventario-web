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
  PurchaseOrderLine,
  PurchaseReceipt,
  PurchaseReceiptLine,
  PurchaseReturnInput,
} from '../../domain/procurement.models';

type ReturnLineForm = FormGroup<{
  purchaseReceiptLineId: FormControl<string>;
  returnedQuantity: FormControl<string>;
  serialNumbers: FormControl<string>;
}>;

const quantityPattern = /^(?:[1-9]\d{0,11})(?:\.\d{1,3})?$/;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-return-dialog',
  styleUrl: '../procurement-dialog.scss',
  templateUrl: './return-dialog.html',
})
export class ReturnDialog implements OnInit {
  readonly order = input.required<PurchaseOrder>();
  readonly receipt = input.required<PurchaseReceipt>();
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  readonly closed = output<void>();
  readonly submitted = output<PurchaseReturnInput>();
  protected readonly localError = signal<string | null>(null);
  private readonly formBuilder = new FormBuilder();
  protected readonly form = this.formBuilder.nonNullable.group({
    documentReference: ['', [Validators.required, Validators.maxLength(160)]],
    reason: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(500)]],
    lines: this.formBuilder.array<ReturnLineForm>([]),
  });

  protected get lines(): FormArray<ReturnLineForm> {
    return this.form.controls.lines;
  }

  ngOnInit(): void {
    for (const line of this.receipt().lines.filter(
      (candidate) => Number(candidate.returnableQuantity) > 0,
    )) {
      this.lines.push(
        this.formBuilder.nonNullable.group({
          purchaseReceiptLineId: [line.id, Validators.required],
          returnedQuantity: ['', Validators.pattern(quantityPattern)],
          serialNumbers: [''],
        }),
      );
    }
  }

  protected receiptLine(index: number): PurchaseReceiptLine {
    const id = this.lines.at(index).controls.purchaseReceiptLineId.value;
    return this.receipt().lines.find((line) => line.id === id)!;
  }

  protected orderLine(index: number): PurchaseOrderLine | undefined {
    const receiptLine = this.receiptLine(index);
    return this.order().lines.find((line) => line.id === receiptLine.purchaseOrderLineId);
  }

  protected submit(): void {
    this.localError.set(null);
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const selected = value.lines.filter((line) => line.returnedQuantity.trim());
    if (!selected.length) {
      this.localError.set('Indica al menos una cantidad a devolver.');
      return;
    }
    const exceeds = selected.some((line) => {
      const receiptLine = this.receipt().lines.find(
        (candidate) => candidate.id === line.purchaseReceiptLineId,
      )!;
      return Number(line.returnedQuantity) > Number(receiptLine.returnableQuantity);
    });
    if (exceeds) {
      this.localError.set('Una cantidad supera lo disponible para devolución.');
      return;
    }
    this.submitted.emit({
      purchaseReceiptId: this.receipt().id,
      documentReference: value.documentReference.trim(),
      reason: value.reason.trim(),
      lines: selected.map((line) => ({
        purchaseReceiptLineId: line.purchaseReceiptLineId,
        returnedQuantity: line.returnedQuantity.trim(),
        serialNumbers: this.serials(line.serialNumbers),
      })),
    });
  }

  private serials(value: string): readonly string[] | undefined {
    const entries = [
      ...new Set(
        value
          .split(/\r?\n/)
          .map((entry) => entry.trim())
          .filter(Boolean),
      ),
    ];
    return entries.length ? entries : undefined;
  }
}
