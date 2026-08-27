import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import {
  CatalogClassificationData,
  CatalogClassificationKind,
  ProductApiService,
} from './product-api.service';

@Component({
  selector: 'app-catalog-classification-panel',
  imports: [FormsModule],
  templateUrl: './catalog-classification-panel.component.html',
  styleUrl: './catalog-classification-panel.component.scss',
})
export class CatalogClassificationPanelComponent implements OnInit {
  private readonly api = inject(ProductApiService);
  readonly changed = output<void>();

  protected readonly categories = signal<CatalogClassificationData[]>([]);
  protected readonly brands = signal<CatalogClassificationData[]>([]);
  protected readonly loading = signal(false);
  protected readonly busyId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected create(kind: CatalogClassificationKind, value: string): void {
    const name = value.trim();
    if (name.length < 2 || this.busyId()) return;
    this.busyId.set(kind);
    this.clearMessages();
    this.api
      .createClassification(kind, name)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: () => {
          this.success.set(`${this.singular(kind)} creada.`);
          this.afterChange();
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  protected rename(
    kind: CatalogClassificationKind,
    item: CatalogClassificationData,
    name: string,
  ): void {
    const trimmed = name.trim();
    if (trimmed === item.name || trimmed.length < 2 || this.busyId()) return;
    this.update(kind, item.id, { name: trimmed }, `${this.singular(kind)} actualizada.`);
  }

  protected reactivate(kind: CatalogClassificationKind, id: string): void {
    this.update(kind, id, { active: true }, `${this.singular(kind)} reactivada.`);
  }

  protected deactivate(
    kind: CatalogClassificationKind,
    item: CatalogClassificationData,
    replacementId: string,
  ): void {
    if (this.busyId()) return;
    this.busyId.set(item.id);
    this.clearMessages();
    this.api
      .deactivateClassification(kind, item.id, replacementId || undefined)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: ({ data }) => {
          this.success.set(
            `${this.singular(kind)} desactivada; ${data.reassignedProducts} producto(s) conservados.`,
          );
          this.afterChange();
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  protected activeReplacements(
    kind: CatalogClassificationKind,
    itemId: string,
  ): CatalogClassificationData[] {
    return this.items(kind).filter(({ id, active }) => active && id !== itemId);
  }

  protected items(kind: CatalogClassificationKind): CatalogClassificationData[] {
    return kind === 'categories' ? this.categories() : this.brands();
  }

  protected singular(kind: CatalogClassificationKind): string {
    return kind === 'categories' ? 'Categoría' : 'Marca';
  }

  private load(): void {
    this.loading.set(true);
    forkJoin({
      categories: this.api.listClassifications('categories', true),
      brands: this.api.listClassifications('brands', true),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ categories, brands }) => {
          this.categories.set(categories.data);
          this.brands.set(brands.data);
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  private update(
    kind: CatalogClassificationKind,
    id: string,
    input: { name?: string; active?: boolean },
    success: string,
  ): void {
    if (this.busyId()) return;
    this.busyId.set(id);
    this.clearMessages();
    this.api
      .updateClassification(kind, id, input)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: () => {
          this.success.set(success);
          this.afterChange();
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  private afterChange(): void {
    this.load();
    this.changed.emit();
  }

  private clearMessages(): void {
    this.error.set(null);
    this.success.set(null);
  }

  private message(error: HttpErrorResponse): string {
    return typeof error.error?.message === 'string'
      ? error.error.message
      : 'No fue posible actualizar categorías y marcas.';
  }
}
