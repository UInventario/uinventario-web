import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { InventoryTransferFacade } from '../../application/inventory-transfer.facade';
import { InventoryTransfer, InventoryTransferLine } from '../../domain/inventory-transfer.models';

interface ReceiptValues {
  readonly received: string;
  readonly discrepancy: string;
  readonly receivedSerials: string;
  readonly discrepancySerials: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-transfer-receipt-dialog',
  styleUrl: './transfer-receipt-dialog.scss',
  templateUrl: './transfer-receipt-dialog.html',
})
export class TransferReceiptDialog implements OnInit {
  private readonly facade = inject(InventoryTransferFacade);
  private readonly formBuilder = inject(FormBuilder);
  private readonly idempotencyKey = `web-transfer-receipt-${crypto.randomUUID()}`;

  readonly transfer = input.required<InventoryTransfer>();
  readonly closed = output<void>();
  readonly received = output<InventoryTransfer>();

  protected readonly form = this.formBuilder.nonNullable.group({
    discrepancyReason: ['', [Validators.maxLength(160)]],
  });
  protected readonly values = signal<Record<string, ReceiptValues>>({});
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.values.set(
      Object.fromEntries(
        this.transfer()
          .lines.filter((line) => Number(line.pendingQuantity) > 0)
          .map((line) => [
            line.id,
            {
              received: line.pendingQuantity,
              discrepancy: '0',
              receivedSerials: '',
              discrepancySerials: '',
            },
          ]),
      ),
    );
  }

  protected pendingLines(): readonly InventoryTransferLine[] {
    return this.transfer().lines.filter((line) => Number(line.pendingQuantity) > 0);
  }

  protected value(lineId: string): ReceiptValues {
    return (
      this.values()[lineId] ?? {
        received: '0',
        discrepancy: '0',
        receivedSerials: '',
        discrepancySerials: '',
      }
    );
  }

  protected update(lineId: string, field: keyof ReceiptValues, value: string): void {
    this.values.update((current) => ({
      ...current,
      [lineId]: { ...this.value(lineId), [field]: value },
    }));
  }

  protected hasDiscrepancy(): boolean {
    return Object.values(this.values()).some(({ discrepancy }) => Number(discrepancy) > 0);
  }

  protected total(field: 'received' | 'discrepancy'): number {
    return Object.values(this.values()).reduce((sum, value) => sum + Number(value[field] || 0), 0);
  }

  protected submit(): void {
    if (this.busy() || this.form.invalid) return;
    this.error.set(null);
    const quantityPattern = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,3})?$/;
    const selected = this.pendingLines().flatMap((line) => {
      const value = this.value(line.id);
      const received = value.received.trim();
      const discrepancy = value.discrepancy.trim();
      if (!quantityPattern.test(received) || !quantityPattern.test(discrepancy)) {
        this.error.set(`Verifica las cantidades de ${line.product.name}.`);
        return [];
      }
      const processed = Number(received) + Number(discrepancy);
      if (processed > Number(line.pendingQuantity)) {
        this.error.set(`La recepción de ${line.product.name} supera lo pendiente.`);
        return [];
      }
      if (processed <= 0) return [];
      const receivedSerialNumbers = this.serials(value.receivedSerials);
      const discrepancySerialNumbers = this.serials(value.discrepancySerials);
      return [
        {
          transferLineId: line.id,
          receivedQuantity: received,
          discrepancyQuantity: discrepancy,
          ...(receivedSerialNumbers.length ? { receivedSerialNumbers } : {}),
          ...(discrepancySerialNumbers.length ? { discrepancySerialNumbers } : {}),
        },
      ];
    });
    if (this.error()) return;
    if (!selected.length) {
      this.error.set('Registra al menos una cantidad recibida o una diferencia.');
      return;
    }
    const discrepancyReason = this.form.controls.discrepancyReason.value.trim();
    if (this.hasDiscrepancy() && discrepancyReason.length < 2) {
      this.error.set('Explica el motivo de las diferencias detectadas.');
      return;
    }
    this.busy.set(true);
    this.facade
      .receive(
        this.transfer().id,
        {
          ...(discrepancyReason ? { discrepancyReason } : {}),
          lines: selected,
        },
        this.idempotencyKey,
      )
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (updated) => this.received.emit(updated),
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected close(): void {
    if (!this.busy()) this.closed.emit();
  }

  private serials(value: string): readonly string[] {
    return [
      ...new Set(
        value
          .split(/[\n,]/)
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible registrar la recepción.';
    const messages: Record<string, string> = {
      INVALID_TRANSFER_RECEIPT: 'La recepción contiene líneas o cantidades no válidas.',
      TRANSFER_DISCREPANCY_REASON_REQUIRED: 'Las diferencias requieren un motivo.',
      TRANSFER_RECEIPT_EXCEEDS_PENDING: 'Una cantidad supera lo pendiente de recibir.',
      TRANSFER_STATUS_CONFLICT: 'La transferencia ya no permite recepciones.',
      INVENTORY_SERIALS_REQUIRED: 'Captura las series recibidas y faltantes requeridas.',
      INVENTORY_SERIAL_STATE_CONFLICT: 'Una serie ya fue procesada en otra operación.',
      IDEMPOTENCY_KEY_REUSED: 'La operación ya fue utilizada con otros datos.',
    };
    return messages[error.code] ?? error.message;
  }
}
