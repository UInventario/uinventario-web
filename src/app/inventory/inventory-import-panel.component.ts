import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, output, signal } from '@angular/core';
import { finalize } from 'rxjs';
import {
  InventoryApiService,
  InventoryImportData,
  InventoryImportMode,
  InventoryStockState,
} from './inventory-api.service';

@Component({
  selector: 'app-inventory-import-panel',
  templateUrl: './inventory-import-panel.component.html',
  styleUrl: './inventory-import-panel.component.scss',
})
export class InventoryImportPanelComponent {
  private readonly inventory = inject(InventoryApiService);
  private selectedFile: File | null = null;
  private pendingConfirmation: { importId: string; key: string } | null = null;

  readonly confirmed = output<void>();
  protected readonly mode = signal<InventoryImportMode>('INITIAL');
  protected readonly filename = signal<string | null>(null);
  protected readonly preview = signal<InventoryImportData | null>(null);
  protected readonly loadingPreview = signal(false);
  protected readonly confirming = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected selectMode(event: Event): void {
    this.mode.set((event.target as HTMLSelectElement).value as InventoryImportMode);
    this.clearPreview();
  }

  protected selectFile(event: Event): void {
    this.selectedFile = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.filename.set(this.selectedFile?.name ?? null);
    this.clearPreview();
  }

  protected createPreview(): void {
    const file = this.selectedFile;
    if (!file || this.loadingPreview()) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx'].includes(extension ?? '')) {
      this.error.set('Selecciona un archivo .csv o .xlsx.');
      return;
    }
    if (file.size === 0 || file.size > 2 * 1024 * 1024) {
      this.error.set('El archivo debe pesar entre 1 byte y 2 MB.');
      return;
    }
    this.loadingPreview.set(true);
    this.error.set(null);
    this.success.set(null);
    this.inventory
      .previewImport(file, this.mode())
      .pipe(finalize(() => this.loadingPreview.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.preview.set(data);
          this.pendingConfirmation = null;
        },
        error: (error: HttpErrorResponse) => this.error.set(this.messageFor(error)),
      });
  }

  protected confirmImport(): void {
    const preview = this.preview();
    if (!preview?.canConfirm || this.confirming()) return;
    const pending = this.pendingConfirmation;
    const key =
      pending?.importId === preview.id
        ? pending.key
        : `web-inventory-import-${globalThis.crypto.randomUUID()}`;
    this.pendingConfirmation = { importId: preview.id, key };
    this.confirming.set(true);
    this.error.set(null);
    this.success.set(null);
    this.inventory
      .confirmImport(preview.id, key)
      .pipe(finalize(() => this.confirming.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.pendingConfirmation = null;
          this.preview.set(data);
          this.success.set(
            `Lote confirmado: ${data.summary.movements ?? 0} movimiento(s) aplicado(s).`,
          );
          this.confirmed.emit();
        },
        error: (error: HttpErrorResponse) => {
          if (error.status > 0 && error.status < 500) this.pendingConfirmation = null;
          this.error.set(this.messageFor(error));
        },
      });
  }

  protected downloadTemplate(): void {
    const content = [
      'sku,location,quantity,state,reason',
      'SKU-001,GENERAL,10,AVAILABLE,Conteo inicial',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla-inventario.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  protected stateLabel(state: InventoryStockState | null): string {
    if (!state) return 'Estado inválido';
    return {
      AVAILABLE: 'Disponible',
      RESERVED: 'Reservado',
      DAMAGED: 'Dañado',
      IN_TRANSIT: 'En tránsito',
    }[state];
  }

  private clearPreview(): void {
    this.preview.set(null);
    this.pendingConfirmation = null;
    this.error.set(null);
    this.success.set(null);
  }

  private messageFor(error: HttpErrorResponse): string {
    const body = error.error as { code?: string; message?: string } | null;
    if (body?.code === 'INVENTORY_IMPORT_STALE') {
      return 'El stock cambió después de la vista previa. Genera una nueva antes de confirmar.';
    }
    if (body?.code === 'INVENTORY_IMPORT_HAS_ERRORS') {
      return 'La política es atómica: corrige todas las filas antes de confirmar.';
    }
    if (body?.message && typeof body.message === 'string') return body.message;
    if (error.status === 0) return 'No fue posible conectar con el servicio de inventario.';
    return 'No fue posible procesar el archivo de inventario.';
  }
}
