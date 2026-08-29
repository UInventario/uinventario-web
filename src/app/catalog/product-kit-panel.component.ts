import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ProductApiService, ProductData, ProductKitData } from './product-api.service';

interface ComponentDraft {
  productId: string;
  quantity: string;
}

@Component({
  selector: 'app-product-kit-panel',
  imports: [FormsModule],
  templateUrl: './product-kit-panel.component.html',
  styleUrl: './product-kit-panel.component.scss',
})
export class ProductKitPanelComponent implements OnInit, OnChanges {
  private readonly productsApi = inject(ProductApiService);

  @Input({ required: true }) product!: ProductData;
  @Output() saved = new EventEmitter<ProductData>();

  protected choices: ProductData[] = [];
  protected componentSearch = '';
  protected enabled = false;
  protected stockMode: ProductKitData['stockMode'] = 'DERIVED';
  protected priceRule: ProductKitData['priceRule'] = 'FIXED';
  protected effectiveFrom = '';
  protected effectiveTo = '';
  protected components: ComponentDraft[] = [];
  protected loadingChoices = false;
  protected saving = false;
  protected error: string | null = null;
  protected success: string | null = null;

  protected get eligible(): boolean {
    return (
      !this.product.parentProductId &&
      (this.product.variantAttributes?.length ?? 0) === 0 &&
      this.product.sellable !== false &&
      (this.product.baseUnit ?? 'UNIT') === 'UNIT' &&
      (this.product.quantityPrecision ?? 0) === 0 &&
      (this.product.minimumQuantity ?? '1.000') === '1.000' &&
      !this.product.trackLots &&
      !this.product.trackSerials
    );
  }

  ngOnInit(): void {
    this.loadChoices();
  }

  ngOnChanges(): void {
    const kit = this.product.kit;
    this.enabled = Boolean(kit);
    this.stockMode = kit?.stockMode ?? 'DERIVED';
    this.priceRule = kit?.priceRule ?? 'FIXED';
    this.effectiveFrom = kit?.effectiveFrom?.slice(0, 10) ?? '';
    this.effectiveTo = kit?.effectiveTo?.slice(0, 10) ?? '';
    this.components =
      kit?.components.map(({ product, quantity }) => ({ productId: product.id, quantity })) ?? [];
    if (!this.components.length) this.components = [{ productId: '', quantity: '1.000' }];
    this.error = null;
    this.success = null;
  }

  protected addComponent(): void {
    if (this.components.length < 50) this.components.push({ productId: '', quantity: '1.000' });
  }

  protected removeComponent(index: number): void {
    if (this.components.length > 1) this.components.splice(index, 1);
  }

  protected save(): void {
    if (this.saving) return;
    this.error = null;
    this.success = null;
    if (this.enabled && !this.eligible) {
      this.error = 'El producto debe venderse por unidad y no controlar lotes ni series.';
      return;
    }
    if (
      this.enabled &&
      this.effectiveFrom &&
      this.effectiveTo &&
      this.effectiveFrom > this.effectiveTo
    ) {
      this.error = 'La vigencia inicial no puede ser posterior a la final.';
      return;
    }
    const quantityPattern = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,3})?$/;
    const normalized = this.components.map(({ productId, quantity }) => ({
      productId,
      quantity: quantity.trim(),
    }));
    if (
      this.enabled &&
      (normalized.some(
        ({ productId, quantity }) =>
          !productId || !quantityPattern.test(quantity) || Number(quantity) <= 0,
      ) ||
        new Set(normalized.map(({ productId }) => productId)).size !== normalized.length)
    ) {
      this.error = 'Selecciona componentes distintos con cantidades mayores que cero.';
      return;
    }
    this.saving = true;
    this.productsApi
      .updateKit(this.product.id, {
        version: this.product.version,
        enabled: this.enabled,
        ...(this.enabled
          ? {
              stockMode: this.stockMode,
              priceRule: this.priceRule,
              ...(this.effectiveFrom ? { effectiveFrom: this.effectiveFrom } : {}),
              ...(this.effectiveTo ? { effectiveTo: this.effectiveTo } : {}),
              components: normalized,
            }
          : {}),
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: ({ data }) => {
          this.product = data;
          this.saved.emit(data);
          this.ngOnChanges();
          this.success = data.kit
            ? 'Kit guardado y disponible para inventario y venta.'
            : 'La configuración de kit fue eliminada.';
        },
        error: (response: HttpErrorResponse) => {
          this.error =
            typeof response.error?.message === 'string'
              ? response.error.message
              : 'No fue posible guardar el kit.';
        },
      });
  }

  protected loadChoices(): void {
    this.loadingChoices = true;
    this.productsApi
      .list({
        ...(this.componentSearch.trim() ? { q: this.componentSearch.trim() } : {}),
        status: 'ACTIVE',
        sellableOnly: true,
        page: 1,
        pageSize: 100,
      })
      .pipe(finalize(() => (this.loadingChoices = false)))
      .subscribe({
        next: ({ data }) => {
          const persisted = (this.product.kit?.components ?? []).map(({ product }) => ({
            ...this.product,
            ...product,
            barcode: null,
            category: null,
            brand: null,
            kit: null,
          }));
          const unique = new Map([...persisted, ...data].map((item) => [item.id, item]));
          this.choices = [...unique.values()].filter(
            ({ id, parentProductId, kit }) => id !== this.product.id && !parentProductId && !kit,
          );
        },
        error: () => (this.error = 'No fue posible cargar los productos componentes.'),
      });
  }
}
