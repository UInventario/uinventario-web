import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, output, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { ProductApiService, ProductImportData } from './product-api.service';

@Component({
  selector: 'app-product-import-panel',
  templateUrl: './product-import-panel.component.html',
})
export class ProductImportPanelComponent {
  private readonly products = inject(ProductApiService);
  private file: File | null = null;
  private confirmation: { id: string; key: string } | null = null;

  readonly confirmed = output<void>();
  protected readonly filename = signal<string | null>(null);
  protected readonly preview = signal<ProductImportData | null>(null);
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
    this.error.set(null);
    this.products
      .previewImport(this.file)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ data }) => this.preview.set(data),
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  protected confirm(): void {
    const preview = this.preview();
    if (!preview?.canConfirm || this.loading()) return;
    const pending = this.confirmation;
    const key =
      pending?.id === preview.id
        ? pending.key
        : `web-product-import-${globalThis.crypto.randomUUID()}`;
    this.confirmation = { id: preview.id, key };
    this.loading.set(true);
    this.error.set(null);
    this.products
      .confirmImport(preview.id, key)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.confirmation = null;
          this.preview.set(data);
          this.confirmed.emit();
        },
        error: (error: HttpErrorResponse) => {
          if (error.status > 0 && error.status < 500) this.confirmation = null;
          this.error.set(this.message(error));
        },
      });
  }

  protected downloadResult(): void {
    const preview = this.preview();
    if (preview?.status !== 'CONFIRMED') return;
    this.products
      .importResult(preview.id)
      .subscribe((blob) =>
        this.download(blob, `resultado-importacion-productos-${preview.id}.csv`),
      );
  }

  protected downloadTemplate(): void {
    const csv = [
      'name,sku,barcode,category,brand,cost,price,active',
      'Café molido,CAFE-001,7500000000001,Bebidas,Marca Casa,80.00,119.90,true',
    ].join('\n');
    this.download(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      'plantilla-productos-v1.csv',
    );
  }

  private download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private message(error: HttpErrorResponse): string {
    const code = (error.error as { code?: string } | null)?.code;
    if (code === 'PRODUCT_IMPORT_STALE')
      return 'El catálogo cambió; genera una nueva vista previa.';
    if (code === 'PRODUCT_IMPORT_HAS_ERRORS') return 'Corrige todas las filas antes de confirmar.';
    if (error.status === 0) return 'No fue posible conectar con el servicio de catálogo.';
    return 'No fue posible procesar la importación de productos.';
  }
}
