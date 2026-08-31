import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { AuthorizationService } from '../../../../../core/authorization/authorization.service';
import { SessionState } from '../../../../../core/session/session-state';
import { InventoryTransferFacade } from '../../application/inventory-transfer.facade';
import {
  InventoryTransfer,
  InventoryTransferStatus,
  TransferBranch,
} from '../../domain/inventory-transfer.models';
import { TransferCreateDialog } from '../transfer-create-dialog/transfer-create-dialog';
import { TransferDetailPanel } from '../transfer-detail-panel/transfer-detail-panel';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule, TransferCreateDialog, TransferDetailPanel],
  selector: 'ui-transfer-page',
  styleUrls: ['./transfer-page.scss', './transfer-page-responsive.scss'],
  templateUrl: './transfer-page.html',
})
export class TransferPage implements OnInit {
  private readonly facade = inject(InventoryTransferFacade);
  private readonly authorization = inject(AuthorizationService);
  private readonly sessions = inject(SessionState);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly filterForm = this.formBuilder.nonNullable.group({ query: [''], status: [''] });
  protected readonly transfers = signal<readonly InventoryTransfer[]>([]);
  protected readonly branches = signal<readonly TransferBranch[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly createOpen = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly canCreate = computed(() => this.authorization.has('INVENTORY_TRANSFER'));
  protected readonly currentWarehouseId = computed(
    () => this.sessions.session()?.context.warehouse?.id ?? null,
  );
  protected readonly currentWarehouseName = computed(
    () => this.sessions.session()?.context.warehouse?.name ?? 'Sin seleccionar',
  );

  ngOnInit(): void {
    this.load();
  }

  protected visibleTransfers(): readonly InventoryTransfer[] {
    const { query, status } = this.filterForm.getRawValue();
    const normalized = query.trim().toLocaleLowerCase();
    return this.transfers().filter(
      (transfer) =>
        (!status || transfer.status === status) &&
        (!normalized ||
          transfer.reference.toLocaleLowerCase().includes(normalized) ||
          transfer.originWarehouse.name.toLocaleLowerCase().includes(normalized) ||
          transfer.destinationWarehouse.name.toLocaleLowerCase().includes(normalized)),
    );
  }

  protected direction(transfer: InventoryTransfer): 'SALIDA' | 'ENTRADA' {
    return transfer.originWarehouse.id === this.currentWarehouseId() ? 'SALIDA' : 'ENTRADA';
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

  protected lineTotal(transfer: InventoryTransfer): number {
    return transfer.lines.reduce((sum, line) => sum + Number(line.quantity), 0);
  }

  protected created(transfer: InventoryTransfer): void {
    this.transfers.update((items) => [transfer, ...items.filter(({ id }) => id !== transfer.id)]);
    this.createOpen.set(false);
    this.selectedId.set(transfer.id);
  }

  protected changed(transfer: InventoryTransfer): void {
    this.transfers.update((items) =>
      items.map((item) => (item.id === transfer.id ? transfer : item)),
    );
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.facade
      .bootstrap()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ transfers, branches }) => {
          this.transfers.set(transfers);
          this.branches.set(branches);
        },
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  private messageFor(error: unknown): string {
    return error instanceof ApiError
      ? error.message
      : 'No fue posible cargar las transferencias de inventario.';
  }
}
