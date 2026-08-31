import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { AuthorizationService } from '../../../../../core/authorization/authorization.service';
import { SessionState } from '../../../../../core/session/session-state';
import { InventoryTransferFacade } from '../../application/inventory-transfer.facade';
import { InventoryTransfer, InventoryTransferStatus } from '../../domain/inventory-transfer.models';
import { TransferReceiptDialog } from '../transfer-receipt-dialog/transfer-receipt-dialog';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, TransferReceiptDialog],
  selector: 'ui-transfer-detail-panel',
  styleUrls: [
    './transfer-detail-panel.scss',
    './transfer-detail-sections.scss',
    './transfer-detail-responsive.scss',
  ],
  templateUrl: './transfer-detail-panel.html',
})
export class TransferDetailPanel implements OnChanges {
  private readonly facade = inject(InventoryTransferFacade);
  private readonly authorization = inject(AuthorizationService);
  private readonly sessions = inject(SessionState);
  private readonly actionKeys = new Map<string, string>();

  readonly transferId = input.required<string>();
  readonly closed = output<void>();
  readonly changed = output<InventoryTransfer>();

  protected readonly transfer = signal<InventoryTransfer | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly dispatchOpen = signal(false);
  protected readonly cancelOpen = signal(false);
  protected readonly receiptOpen = signal(false);
  protected readonly currentWarehouseId = computed(
    () => this.sessions.session()?.context.warehouse?.id ?? null,
  );
  protected readonly canDispatch = computed(() => {
    const item = this.transfer();
    return (
      !!item &&
      item.status === 'DRAFT' &&
      item.originWarehouse.id === this.currentWarehouseId() &&
      this.authorization.has('INVENTORY_APPROVE')
    );
  });
  protected readonly canCancel = this.canDispatch;
  protected readonly canReceive = computed(() => {
    const item = this.transfer();
    return (
      !!item &&
      ['DISPATCHED', 'PARTIALLY_RECEIVED'].includes(item.status) &&
      item.destinationWarehouse.id === this.currentWarehouseId() &&
      this.authorization.has('INVENTORY_TRANSFER')
    );
  });

  ngOnChanges(): void {
    this.load(this.transferId());
  }

  protected statusLabel(status: InventoryTransferStatus): string {
    return {
      DRAFT: 'Borrador',
      DISPATCHED: 'En tránsito',
      PARTIALLY_RECEIVED: 'Recepción parcial',
      RECEIVED: 'Recibida',
      CANCELLED: 'Cancelada',
    }[status];
  }

  protected total(
    field: 'quantity' | 'receivedQuantity' | 'discrepancyQuantity' | 'pendingQuantity',
  ) {
    return this.transfer()?.lines.reduce((sum, line) => sum + Number(line[field]), 0) ?? 0;
  }

  protected dispatch(): void {
    const item = this.transfer();
    if (!item || !this.canDispatch() || this.busy()) return;
    const keyName = `dispatch:${item.id}`;
    this.run('dispatch', this.facade.dispatch(item.id, this.keyFor(keyName)), (updated) => {
      this.actionKeys.delete(keyName);
      this.apply(updated, 'Transferencia aprobada y despachada. El stock quedó en tránsito.');
      this.dispatchOpen.set(false);
    });
  }

  protected cancel(): void {
    const item = this.transfer();
    if (!item || !this.canCancel() || this.busy()) return;
    this.run('cancel', this.facade.cancel(item.id), (updated) => {
      this.apply(updated, 'Borrador cancelado. No hubo movimiento de inventario.');
      this.cancelOpen.set(false);
    });
  }

  protected received(updated: InventoryTransfer): void {
    this.receiptOpen.set(false);
    this.apply(
      updated,
      updated.status === 'RECEIVED'
        ? 'Recepción completada; el inventario disponible y las diferencias quedaron conciliados.'
        : 'Recepción parcial registrada; el remanente continúa en tránsito.',
    );
  }

  private load(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.facade
      .get(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (transfer) => this.transfer.set(transfer),
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  private apply(updated: InventoryTransfer, notice: string): void {
    this.transfer.set(updated);
    this.error.set(null);
    this.notice.set(notice);
    this.changed.emit(updated);
  }

  private run<T>(
    action: string,
    operation: import('rxjs').Observable<T>,
    success: (value: T) => void,
  ): void {
    this.busy.set(action);
    this.error.set(null);
    this.notice.set(null);
    operation.pipe(finalize(() => this.busy.set(null))).subscribe({
      next: success,
      error: (error: unknown) => this.error.set(this.messageFor(error)),
    });
  }

  private keyFor(action: string): string {
    const existing = this.actionKeys.get(action);
    if (existing) return existing;
    const created = `web-transfer-${action}-${crypto.randomUUID()}`;
    this.actionKeys.set(action, created);
    return created;
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible completar la operación.';
    const messages: Record<string, string> = {
      TRANSFER_STATUS_CONFLICT: 'La transferencia cambió de estado; actualiza el detalle.',
      INSUFFICIENT_AVAILABLE_STOCK: 'El origen ya no tiene existencia disponible suficiente.',
      INVENTORY_FIFO_LAYER_SHORTAGE:
        'El origen no tiene capas de costo suficientes para despachar.',
      INVENTORY_SERIALS_REQUIRED: 'Faltan series requeridas para completar el movimiento.',
      INVENTORY_SERIAL_STATE_CONFLICT: 'Una serie ya no está disponible en el origen.',
      IDEMPOTENCY_KEY_REUSED: 'La operación ya fue utilizada con otros datos.',
    };
    return messages[error.code] ?? error.message;
  }
}
