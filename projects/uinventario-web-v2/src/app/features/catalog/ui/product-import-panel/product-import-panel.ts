import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { CatalogFacade } from '../../application/catalog.facade';
import { ProductImport } from '../../domain/catalog.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'ui-product-import-panel',
  styleUrl: './product-import-panel.scss',
  templateUrl: './product-import-panel.html',
})
export class ProductImportPanel {
  private readonly catalog = inject(CatalogFacade);
  private file: File | null = null;
  private confirmationKey: string | null = null;
  readonly confirmed = output<void>();
  protected readonly filename = signal<string | null>(null);
  protected readonly preview = signal<ProductImport | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected selectFile(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.filename.set(this.file?.name ?? null);
    this.preview.set(null);
    this.error.set(null);
  }
  protected analyze(): void {
    if (!this.file || this.loading()) return;
    this.loading.set(true);
    this.catalog
      .previewImport(this.file)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (preview) => this.preview.set(preview),
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }
  protected confirm(): void {
    const preview = this.preview();
    if (!preview?.canConfirm || this.loading()) return;
    this.confirmationKey ??= `web-v2-product-import:${crypto.randomUUID()}`;
    this.loading.set(true);
    this.catalog
      .confirmImport(preview.id, this.confirmationKey)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          this.confirmationKey = null;
          this.preview.set(result);
          this.confirmed.emit();
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }
  protected downloadTemplate(): void {
    this.download(
      new Blob(
        [
          'name,sku,barcode,category,brand,cost,price,active\nCafé molido,CAFE-001,7500000000001,Bebidas,Marca Casa,80.00,119.90,true',
        ],
        { type: 'text/csv;charset=utf-8' },
      ),
      'plantilla-productos-v1.csv',
    );
  }
  protected downloadResult(): void {
    const preview = this.preview();
    if (!preview || preview.status !== 'CONFIRMED') return;
    this.catalog.downloadImportResult(preview.id).subscribe({
      next: (blob) => this.download(blob, `resultado-importacion-${preview.id}.csv`),
      error: (error: unknown) => this.error.set(this.message(error)),
    });
  }
  private download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
  private message(error: unknown): string {
    if (error instanceof ApiError && error.code === 'PRODUCT_IMPORT_STALE')
      return 'El catálogo cambió; genera una nueva vista previa.';
    if (error instanceof ApiError && error.code === 'PRODUCT_IMPORT_HAS_ERRORS')
      return 'Corrige todas las filas antes de confirmar.';
    return error instanceof ApiError ? error.message : 'No fue posible procesar la importación.';
  }
}
