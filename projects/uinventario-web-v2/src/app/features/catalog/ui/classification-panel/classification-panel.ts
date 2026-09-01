import { ChangeDetectionStrategy, Component, OnInit, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { CatalogFacade } from '../../application/catalog.facade';
import { Classification, ClassificationKind } from '../../domain/catalog.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  selector: 'ui-catalog-classification-panel',
  styleUrl: './classification-panel.scss',
  templateUrl: './classification-panel.html',
})
export class CatalogClassificationPanel implements OnInit {
  private readonly catalog = inject(CatalogFacade);
  readonly changed = output<void>();
  protected readonly categories = signal<readonly Classification[]>([]);
  protected readonly brands = signal<readonly Classification[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly editing = signal<{ kind: ClassificationKind; item?: Classification } | null>(
    null,
  );
  protected readonly retiring = signal<{ kind: ClassificationKind; item: Classification } | null>(
    null,
  );
  protected name = '';
  protected replacementId = '';

  ngOnInit(): void {
    this.load();
  }

  protected open(kind: ClassificationKind, item?: Classification): void {
    this.error.set(null);
    this.name = item?.name ?? '';
    this.editing.set({ kind, item });
  }

  protected save(): void {
    const editor = this.editing();
    if (!editor || this.name.trim().length < 2 || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    const request = editor.item
      ? this.catalog.updateClassification(editor.kind, editor.item.id, this.name)
      : this.catalog.createClassification(editor.kind, this.name);
    request.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: () => {
        this.editing.set(null);
        this.load();
        this.changed.emit();
      },
      error: (error: unknown) => this.error.set(this.message(error)),
    });
  }

  protected reactivate(kind: ClassificationKind, item: Classification): void {
    this.loading.set(true);
    this.catalog
      .reactivateClassification(kind, item.id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          this.load();
          this.changed.emit();
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  protected requestRetirement(kind: ClassificationKind, item: Classification): void {
    this.error.set(null);
    this.replacementId = '';
    this.retiring.set({ kind, item });
  }

  protected confirmRetirement(): void {
    const candidate = this.retiring();
    if (!candidate || (candidate.item.productCount > 0 && !this.replacementId) || this.loading())
      return;
    this.loading.set(true);
    this.catalog
      .retireClassification(candidate.kind, candidate.item.id, this.replacementId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          this.retiring.set(null);
          this.load();
          this.changed.emit();
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  protected items(kind: ClassificationKind): readonly Classification[] {
    return kind === 'categories' ? this.categories() : this.brands();
  }

  protected replacements(): readonly Classification[] {
    const candidate = this.retiring();
    return candidate
      ? this.items(candidate.kind).filter((item) => item.active && item.id !== candidate.item.id)
      : [];
  }

  private load(): void {
    this.loading.set(true);
    forkJoin({
      categories: this.catalog.listClassifications('categories'),
      brands: this.catalog.listClassifications('brands'),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ categories, brands }) => {
          this.categories.set(categories);
          this.brands.set(brands);
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  private message(error: unknown): string {
    if (error instanceof ApiError && error.kind === 'conflict')
      return 'Ya existe una clasificación con ese nombre.';
    return error instanceof ApiError
      ? error.message
      : 'No fue posible actualizar las clasificaciones.';
  }
}
