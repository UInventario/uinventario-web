import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { AuthorizationService } from '../../../../../core/authorization/authorization.service';
import { InventoryOperationsFacade } from '../../application/inventory-operations.facade';
import { ImportMode, InventoryImport } from '../../domain/inventory-operations.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  selector: 'ui-inventory-import-panel',
  styleUrls: ['./import-panel.scss', './import-panel-responsive.scss'],
  templateUrl: './import-panel.html',
})
export class ImportPanel {
  private readonly authorization = inject(AuthorizationService);
  private readonly facade = inject(InventoryOperationsFacade);
  protected file: File | null = null;
  private confirmationKey: string | null = null;

  protected readonly canAdjust = computed(() => this.authorization.has('INVENTORY_ADJUST'));
  protected readonly loading = signal(false);
  protected readonly filename = signal<string | null>(null);
  protected readonly mode = signal<ImportMode>('COUNT');
  protected readonly preview = signal<InventoryImport | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected selectFile(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.filename.set(this.file?.name ?? null);
    this.preview.set(null);
    this.confirmationKey = null;
    this.clearMessages();
  }

  protected setMode(value: string): void {
    this.mode.set(value === 'INITIAL' ? 'INITIAL' : 'COUNT');
    this.preview.set(null);
    this.confirmationKey = null;
  }

  protected previewFile(): void {
    if (!this.file || this.loading()) return;
    this.clearMessages();
    this.loading.set(true);
    this.facade
      .previewImport(this.file, this.mode())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (preview) => {
          this.preview.set(preview);
          this.confirmationKey = `web-${crypto.randomUUID()}`;
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  protected confirm(): void {
    const preview = this.preview();
    if (!preview?.canConfirm || !this.confirmationKey || this.loading()) return;
    this.clearMessages();
    this.loading.set(true);
    this.facade
      .confirmImport(preview.id, this.confirmationKey)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          this.preview.set(result);
          this.confirmationKey = null;
          this.notice.set(`${result.summary.movements ?? 0} movimiento(s) auditado(s) aplicados.`);
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  private clearMessages(): void {
    this.error.set(null);
    this.notice.set(null);
  }

  private message(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible procesar el archivo.';
    const messages: Record<string, string> = {
      INVENTORY_IMPORT_HAS_ERRORS: 'La importación es atómica: corrige todas las filas con error.',
      INVENTORY_IMPORT_STALE: 'El stock cambió. Genera una vista previa nueva.',
      INVALID_INVENTORY_IMPORT_HEADERS: 'El archivo no contiene las columnas requeridas.',
    };
    return (error.code && messages[error.code]) || error.message;
  }
}
