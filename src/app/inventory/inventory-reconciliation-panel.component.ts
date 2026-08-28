import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { SessionApiService } from '../auth/session-api.service';
import {
  InventoryApiService,
  InventoryReconciliationRunData,
} from './inventory-api.service';

@Component({
  selector: 'app-inventory-reconciliation-panel',
  imports: [DatePipe],
  templateUrl: './inventory-reconciliation-panel.component.html',
  styleUrl: './inventory-reconciliation-panel.component.scss',
})
export class InventoryReconciliationPanelComponent implements OnInit {
  private readonly inventory = inject(InventoryApiService);
  private readonly sessions = inject(SessionApiService);
  private pendingKey: string | null = null;

  protected readonly canRun = computed(
    () => this.sessions.session()?.user.permissions.includes('INVENTORY_ADJUST') ?? false,
  );
  protected readonly run = signal<InventoryReconciliationRunData | null>(null);
  protected readonly loading = signal(true);
  protected readonly running = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected reconcile(): void {
    if (!this.canRun() || this.running()) return;
    this.pendingKey ??= `web-inventory-reconciliation-${globalThis.crypto.randomUUID()}`;
    this.running.set(true);
    this.error.set(null);
    this.inventory
      .runReconciliation(this.pendingKey)
      .pipe(finalize(() => this.running.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.pendingKey = null;
          this.run.set(data);
        },
        error: (error: HttpErrorResponse) => {
          if (error.status > 0 && error.status < 500) this.pendingKey = null;
          this.error.set(this.messageFor(error));
        },
      });
  }

  protected statusLabel(status: InventoryReconciliationRunData['overallStatus']): string {
    return { HEALTHY: 'Conciliado', WARNING: 'Con advertencias', CRITICAL: 'Crítico' }[status];
  }

  private load(): void {
    this.loading.set(true);
    this.inventory
      .latestReconciliation()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ data }) => this.run.set(data),
        error: (error: HttpErrorResponse) => this.error.set(this.messageFor(error)),
      });
  }

  private messageFor(error: HttpErrorResponse): string {
    if (error.status === 403) return 'No tienes permiso para ejecutar la reconciliación.';
    if (error.status === 0) return 'No fue posible conectar con el servicio de inventario.';
    return 'No fue posible reconciliar el inventario.';
  }
}
