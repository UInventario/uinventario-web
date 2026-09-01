import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { OfflineCommand } from '../../core/offline/offline.models';
import { OfflineOperationalState, OfflineSync } from '../../core/offline/offline-sync';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  selector: 'ui-offline-center',
  styleUrl: './offline-center.scss',
  templateUrl: './offline-center.html',
})
export class OfflineCenter implements OnInit, OnDestroy {
  protected readonly sync = inject(OfflineSync);
  protected readonly open = signal(false);
  private freshnessTimer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    void this.sync.restore().catch(() => undefined);
    this.freshnessTimer = setInterval(
      () => void this.sync.restore().catch(() => undefined),
      30_000,
    );
  }

  ngOnDestroy(): void {
    if (this.freshnessTimer !== undefined) clearInterval(this.freshnessTimer);
  }

  protected prepare(): void {
    void this.sync.prepare().catch(() => undefined);
  }

  protected synchronize(): void {
    void this.sync.reconnect().catch(() => undefined);
  }

  protected retry(commandId: string): void {
    void this.sync.retry(commandId).catch(() => undefined);
  }

  protected discard(commandId: string): void {
    void this.sync.discard(commandId).catch(() => undefined);
  }

  protected stateLabel(state: OfflineOperationalState): string {
    return {
      ONLINE: 'En línea',
      OFFLINE: 'Sin conexión',
      SYNCING: 'Sincronizando',
      STALE: 'Datos vencidos',
      CONFLICT: 'Conflictos',
    }[state];
  }

  protected commandLabel(command: OfflineCommand): string {
    return {
      CASH_SALE: 'Venta en efectivo',
      INVENTORY_COUNT: 'Conteo de inventario',
      INVENTORY_MOVEMENT: 'Movimiento de inventario',
    }[command.kind];
  }

  protected commandError(command: OfflineCommand): string {
    const error = command.error as {
      readonly details?: { readonly message?: string; readonly code?: string };
      readonly conflict?: { readonly userAction?: string };
      readonly message?: string;
    } | null;
    return (
      error?.conflict?.userAction ??
      error?.details?.message ??
      error?.details?.code ??
      error?.message ??
      'Revisa los datos actuales antes de decidir.'
    );
  }
}
