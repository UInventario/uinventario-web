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
  PurchaseReceiptInput,
  ReceiptLocation,
} from '../../domain/procurement.models';

type ReceiptLineForm = FormGroup<{
  purchaseOrderLineId: FormControl<string>;
  receivedQuantity: FormControl<string>;
  lotCode: FormControl<string>;
  manufacturedOn: FormControl<string>;
  expiresOn: FormControl<string>;
  serialNumbers: FormControl<string>;
}>;

const quantityPattern = /^(?:[1-9]\d{0,11})(?:\.\d{1,3})?$/;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-receipt-dialog',
  styleUrl: '../procurement-dialog.scss',
  templateUrl: './receipt-dialog.html',
})
export class ReceiptDialog implements OnInit {
  readonly order = input.required<PurchaseOrder>();
  readonly locations = input.required<readonly ReceiptLocation[]>();
  readonly canOverReceive = input(false);
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  readonly closed = output<void>();
  readonly submitted = output<PurchaseReceiptInput>();
  protected readonly localError = signal<string | null>(null);
  private readonly formBuilder = new FormBuilder();
  protected readonly form = this.formBuilder.nonNullable.group({
    locationId: ['', Validators.required],
    documentReference: ['', [Validators.required, Validators.maxLength(160)]],
    overageReason: ['', Validators.maxLength(500)],
    lines: this.formBuilder.array<ReceiptLineForm>([]),
  });

  protected get lines(): FormArray<ReceiptLineForm> {
    return this.form.controls.lines;
  }

  ngOnInit(): void {
    this.form.controls.locationId.setValue(this.locations()[0]?.id ?? '');
    for (const line of this.order().lines.filter(
      (candidate) => Number(candidate.remainingQuantity) > 0,
    )) {
      this.lines.push(
        this.formBuilder.nonNullable.group({
          purchaseOrderLineId: [line.id, Validators.required],
          receivedQuantity: [line.remainingQuantity, Validators.pattern(quantityPattern)],
          lotCode: ['', Validators.maxLength(64)],
          manufacturedOn: [''],
          expiresOn: [''],
          serialNumbers: [''],
        }),
      );
    }
    if (!this.lines.length) {
      for (const line of this.order().lines) {
        this.lines.push(
          this.formBuilder.nonNullable.group({
            purchaseOrderLineId: [line.id, Validators.required],
            receivedQuantity: ['', Validators.pattern(quantityPattern)],
            lotCode: ['', Validators.maxLength(64)],
            manufacturedOn: [''],
            expiresOn: [''],
            serialNumbers: [''],
          }),
        );
      }
    }
  }

  protected orderLine(index: number): PurchaseOrderLine {
    const id = this.lines.at(index).controls.purchaseOrderLineId.value;
    return this.order().lines.find((line) => line.id === id)!;
  }

  protected submit(): void {
    this.localError.set(null);
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const selected = value.lines.filter((line) => line.receivedQuantity.trim());
    if (!selected.length) {
      this.localError.set('Indica al menos una cantidad recibida.');
      return;
    }
    const hasInvalidDates = selected.some(
      (line) => line.manufacturedOn && line.expiresOn && line.manufacturedOn > line.expiresOn,
    );
    if (hasInvalidDates) {
      this.localError.set('La fabricación no puede ser posterior a la caducidad.');
      return;
    }
    const hasOverage = selected.some((line) => {
      const ordered = this.order().lines.find(
        (candidate) => candidate.id === line.purchaseOrderLineId,
      )!;
      return Number(line.receivedQuantity) > Number(ordered.remainingQuantity);
    });
    if (hasOverage && !this.canOverReceive()) {
      this.localError.set('No tienes permiso para recibir cantidades mayores a las pendientes.');
      return;
    }
    if (hasOverage && value.overageReason.trim().length < 3) {
      this.localError.set('Explica el sobrante con al menos 3 caracteres.');
      return;
    }
    this.submitted.emit({
      version: this.order().version,
      locationId: value.locationId,
      documentReference: value.documentReference.trim(),
      overageReason: value.overageReason.trim() || undefined,
      lines: selected.map((line) => ({
        purchaseOrderLineId: line.purchaseOrderLineId,
        receivedQuantity: line.receivedQuantity.trim(),
        lotCode: line.lotCode.trim() || undefined,
        manufacturedOn: line.manufacturedOn || undefined,
        expiresOn: line.expiresOn || undefined,
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
