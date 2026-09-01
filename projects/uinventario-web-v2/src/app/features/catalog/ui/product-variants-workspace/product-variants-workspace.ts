import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { CatalogFacade } from '../../application/catalog.facade';
import { Product } from '../../domain/catalog.models';
import {
  ProductVariantDraft,
  VariantAttributeDraft,
  buildVariantDrafts,
  parseVariantAttributes,
  variantDraftsError,
} from '../../domain/product-variant-drafts';

type TextVariantField = 'sku' | 'barcode' | 'cost' | 'price';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'ui-product-variants-workspace',
  styleUrl: './product-variants-workspace.scss',
  templateUrl: './product-variants-workspace.html',
})
export class ProductVariantsWorkspace implements OnChanges {
  private readonly catalog = inject(CatalogFacade);

  @Input({ required: true }) product!: Product;
  @Output() readonly saved = new EventEmitter<Product>();

  protected readonly attributes = signal<readonly VariantAttributeDraft[]>([]);
  protected readonly variants = signal<readonly ProductVariantDraft[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly saving = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['product']) return;
    const attributes = this.product.variantAttributes ?? [];
    this.attributes.set(
      attributes.length
        ? attributes.map((attribute) => ({
            name: attribute.name,
            valuesText: attribute.values.join(', '),
          }))
        : [{ name: '', valuesText: '' }],
    );
    this.variants.set(attributes.length ? buildVariantDrafts(this.product, attributes) : []);
  }

  protected addAttribute(): void {
    if (this.attributes().length >= 3) return;
    this.attributes.update((attributes) => [...attributes, { name: '', valuesText: '' }]);
    this.configurationChanged();
  }

  protected removeAttribute(index: number): void {
    if (this.attributes().length <= 1) return;
    this.attributes.update((attributes) => attributes.filter((_, position) => position !== index));
    this.configurationChanged();
  }

  protected updateAttribute(
    index: number,
    field: keyof VariantAttributeDraft,
    value: string,
  ): void {
    this.attributes.update((attributes) =>
      attributes.map((attribute, position) =>
        position === index ? { ...attribute, [field]: value } : attribute,
      ),
    );
    this.configurationChanged();
  }

  protected generate(): void {
    this.error.set(null);
    this.notice.set(null);
    const parsed = parseVariantAttributes(this.attributes());
    if (parsed.error || !parsed.attributes) {
      this.error.set(parsed.error);
      return;
    }
    const generated = buildVariantDrafts(this.product, parsed.attributes, this.variants());
    this.variants.set(generated);
    this.notice.set(`${generated.length} combinación(es) listas para revisar.`);
  }

  protected updateVariant(index: number, field: TextVariantField, value: string): void {
    this.variants.update((variants) =>
      variants.map((variant, position) =>
        position === index ? { ...variant, [field]: value } : variant,
      ),
    );
    this.notice.set(null);
  }

  protected updateVariantActive(index: number, active: boolean): void {
    this.variants.update((variants) =>
      variants.map((variant, position) => (position === index ? { ...variant, active } : variant)),
    );
    this.notice.set(null);
  }

  protected save(): void {
    if (this.saving() || this.product.kit) return;
    this.error.set(null);
    this.notice.set(null);
    const parsed = parseVariantAttributes(this.attributes());
    if (parsed.error || !parsed.attributes) {
      this.error.set(parsed.error);
      return;
    }
    const draftError = variantDraftsError(parsed.attributes, this.variants());
    if (draftError) {
      this.error.set(draftError);
      return;
    }
    this.saving.set(true);
    this.catalog
      .updateVariants(this.product.id, {
        version: this.product.version,
        attributes: parsed.attributes,
        variants: this.variants().map((variant) => ({
          id: variant.id,
          version: variant.version,
          values: variant.values,
          sku: variant.sku,
          barcode: variant.barcode || undefined,
          cost: variant.cost,
          price: variant.price,
          active: variant.active,
        })),
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (product) => {
          this.saved.emit(product);
          this.notice.set('Variantes guardadas. Ya están disponibles para inventario y venta.');
        },
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  private configurationChanged(): void {
    this.notice.set(null);
    if (this.variants().length) {
      this.error.set('Los atributos cambiaron. Genera nuevamente las combinaciones.');
    } else {
      this.error.set(null);
    }
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible guardar las variantes.';
    if (error.code === 'PRODUCT_VERSION_CONFLICT') {
      return 'El producto cambió. Vuelve al catálogo y abre nuevamente esta configuración.';
    }
    if (error.code === 'PRODUCT_VARIANTS_REQUIRE_ZERO_STOCK') {
      return 'Deja el stock del producto base en cero antes de habilitar variantes.';
    }
    return error.message;
  }
}
