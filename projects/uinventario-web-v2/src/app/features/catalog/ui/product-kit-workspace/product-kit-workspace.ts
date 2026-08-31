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
import { Product, ProductKit } from '../../domain/catalog.models';
import { productQuantityValueError } from '../../domain/product-quantity-policy';

interface KitComponentDraft {
  readonly productId: string;
  readonly quantity: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'ui-product-kit-workspace',
  styleUrl: './product-kit-workspace.scss',
  templateUrl: './product-kit-workspace.html',
})
export class ProductKitWorkspace implements OnChanges {
  private readonly catalog = inject(CatalogFacade);

  @Input({ required: true }) product!: Product;
  @Input({ required: true }) candidates: readonly Product[] = [];
  @Output() readonly saved = new EventEmitter<Product>();

  protected readonly enabled = signal(false);
  protected readonly stockMode = signal<ProductKit['stockMode']>('DERIVED');
  protected readonly priceRule = signal<ProductKit['priceRule']>('FIXED');
  protected readonly effectiveFrom = signal('');
  protected readonly effectiveTo = signal('');
  protected readonly components = signal<readonly KitComponentDraft[]>([]);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['product']) return;
    const kit = this.product.kit;
    this.enabled.set(Boolean(kit));
    this.stockMode.set(kit?.stockMode ?? 'DERIVED');
    this.priceRule.set(kit?.priceRule ?? 'FIXED');
    this.effectiveFrom.set(kit?.effectiveFrom?.slice(0, 10) ?? '');
    this.effectiveTo.set(kit?.effectiveTo?.slice(0, 10) ?? '');
    this.components.set(
      kit?.components.map((component) => ({
        productId: component.product.id,
        quantity: component.quantity,
      })) ?? [],
    );
  }

  protected setEnabled(value: boolean): void {
    this.enabled.set(value);
    this.clearMessages();
    if (value && !this.components().length) this.addComponent();
  }

  protected setStockMode(value: string): void {
    this.stockMode.set(value as ProductKit['stockMode']);
    this.clearMessages();
  }

  protected setPriceRule(value: string): void {
    this.priceRule.set(value as ProductKit['priceRule']);
    this.clearMessages();
  }

  protected addComponent(): void {
    const candidate = this.availableCandidates(-1)[0];
    if (!candidate) {
      this.error.set('No hay otro producto vendible disponible para agregar como componente.');
      return;
    }
    this.components.update((components) => [
      ...components,
      { productId: candidate.id, quantity: candidate.minimumQuantity },
    ]);
    this.clearMessages();
  }

  protected removeComponent(index: number): void {
    this.components.update((components) => components.filter((_, position) => position !== index));
    this.clearMessages();
  }

  protected updateComponentProduct(index: number, productId: string): void {
    const candidate = this.candidate(productId);
    this.components.update((components) =>
      components.map((component, position) =>
        position === index
          ? { productId, quantity: candidate?.minimumQuantity ?? component.quantity }
          : component,
      ),
    );
    this.clearMessages();
  }

  protected updateComponentQuantity(index: number, quantity: string): void {
    this.components.update((components) =>
      components.map((component, position) =>
        position === index ? { ...component, quantity } : component,
      ),
    );
    this.clearMessages();
  }

  protected availableCandidates(index: number): readonly Product[] {
    const selected = new Set(
      this.components()
        .filter((_, position) => position !== index)
        .map((component) => component.productId),
    );
    return this.candidates.filter(
      (candidate) =>
        candidate.id !== this.product.id &&
        candidate.active &&
        candidate.sellable &&
        !candidate.trackLots &&
        !candidate.trackSerials &&
        !selected.has(candidate.id),
    );
  }

  protected candidate(productId: string): Product | undefined {
    return this.candidates.find((candidate) => candidate.id === productId);
  }

  protected componentError(component: KitComponentDraft): string | null {
    const candidate = this.candidate(component.productId);
    return candidate
      ? productQuantityValueError(candidate, component.quantity)
      : 'Selecciona un producto disponible.';
  }

  protected eligibilityError(): string | null {
    if ((this.product.variantAttributes?.length ?? 0) > 0) {
      return 'Un producto con variantes no puede configurarse también como kit.';
    }
    if (
      this.product.baseUnit !== 'UNIT' ||
      this.product.quantityPrecision !== 0 ||
      Number(this.product.minimumQuantity) !== 1 ||
      this.product.trackLots ||
      this.product.trackSerials
    ) {
      return 'Para ser kit, el producto debe usar unidades enteras, mínimo 1 y no controlar lotes ni series.';
    }
    return null;
  }

  protected save(): void {
    if (this.saving()) return;
    this.clearMessages();
    if (!this.enabled()) {
      this.persist({ version: this.product.version, enabled: false });
      return;
    }
    const eligibility = this.eligibilityError();
    if (eligibility) {
      this.error.set(eligibility);
      return;
    }
    if (!this.components().length) {
      this.error.set('Agrega al menos un componente al kit.');
      return;
    }
    const invalidComponent = this.components().find((component) => this.componentError(component));
    if (invalidComponent) {
      this.error.set(this.componentError(invalidComponent));
      return;
    }
    if (this.effectiveFrom() && this.effectiveTo() && this.effectiveFrom() > this.effectiveTo()) {
      this.error.set('La vigencia final no puede ser anterior a la inicial.');
      return;
    }
    this.persist({
      version: this.product.version,
      enabled: true,
      stockMode: this.stockMode(),
      priceRule: this.priceRule(),
      effectiveFrom: this.toIsoDate(this.effectiveFrom()),
      effectiveTo: this.toIsoDate(this.effectiveTo()),
      components: this.components(),
    });
  }

  private persist(input: Parameters<CatalogFacade['updateKit']>[1]): void {
    this.saving.set(true);
    this.catalog
      .updateKit(this.product.id, input)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (product) => {
          this.saved.emit(product);
          this.notice.set(
            input.enabled ? 'Kit guardado y listo para operar.' : 'Configuración de kit eliminada.',
          );
        },
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected clearMessages(): void {
    this.error.set(null);
    this.notice.set(null);
  }

  private toIsoDate(value: string): string | undefined {
    return value ? `${value}T00:00:00.000Z` : undefined;
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible guardar el kit.';
    if (error.code === 'PRODUCT_VERSION_CONFLICT') {
      return 'El producto cambió. Vuelve al catálogo y abre nuevamente esta configuración.';
    }
    return error.message;
  }
}
