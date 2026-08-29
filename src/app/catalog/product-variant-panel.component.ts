import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ProductApiService, ProductData, ProductVariantInput } from './product-api.service';

interface AttributeDraft {
  name: string;
  valuesText: string;
}

interface VariantDraft extends ProductVariantInput {
  label: string;
}

@Component({
  selector: 'app-product-variant-panel',
  imports: [FormsModule],
  templateUrl: './product-variant-panel.component.html',
  styleUrl: './product-variant-panel.component.scss',
})
export class ProductVariantPanelComponent implements OnChanges {
  private readonly products = inject(ProductApiService);

  @Input({ required: true }) product!: ProductData;
  @Output() saved = new EventEmitter<ProductData>();

  protected attributes: AttributeDraft[] = [];
  protected variants: VariantDraft[] = [];
  protected error: string | null = null;
  protected success: string | null = null;
  protected saving = false;

  ngOnChanges(): void {
    const persistedAttributes = this.product.variantAttributes ?? [];
    this.attributes = (
      persistedAttributes.length ? persistedAttributes : [{ name: 'Talla', values: [] }]
    ).map(({ name, values }) => ({ name, valuesText: values.join(', ') }));
    if (persistedAttributes.length) this.rebuild(false);
    else {
      this.variants = [];
      this.error = null;
      this.success = null;
    }
  }

  protected addAttribute(): void {
    if (this.attributes.length < 3) this.attributes.push({ name: '', valuesText: '' });
  }

  protected removeAttribute(index: number): void {
    if (this.attributes.length > 1) this.attributes.splice(index, 1);
  }

  protected rebuild(showSuccess = true): void {
    this.error = null;
    this.success = null;
    const parsed = this.parsedAttributes();
    if (!parsed) return;
    const combinations = this.cartesian(parsed.map(({ values }) => values));
    if (combinations.length > 100) {
      this.error = 'La configuración supera el máximo de 100 combinaciones.';
      return;
    }
    const existing = new Map(
      (this.product.variants ?? []).map((variant) => [
        this.key((variant.variantValues ?? []).map(({ value }) => value)),
        variant,
      ]),
    );
    const current = new Map(this.variants.map((variant) => [this.key(variant.values), variant]));
    this.variants = combinations.map((values, index) => {
      const previous = current.get(this.key(values));
      const persisted = existing.get(this.key(values));
      if (previous) return { ...previous, label: values.join(' / ') };
      return {
        ...(persisted ? { id: persisted.id, version: persisted.version } : {}),
        values,
        label: values.join(' / '),
        sku: persisted?.sku ?? this.generatedSku(values, index),
        barcode: persisted?.barcode ?? '',
        cost: persisted?.cost ?? this.product.cost,
        price: persisted?.price ?? this.product.price,
        active: persisted?.active ?? true,
      };
    });
    if (showSuccess) this.success = `${this.variants.length} combinación(es) generadas.`;
  }

  protected save(): void {
    if (this.saving) return;
    const attributes = this.parsedAttributes();
    if (!attributes || this.variants.length === 0) return;
    const skuPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
    const barcodePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{3,63}$/;
    const moneyPattern = /^(0|[1-9]\d{0,11})(\.\d{1,2})?$/;
    const invalid = this.variants.find(
      ({ sku, barcode, cost, price }) =>
        !skuPattern.test(sku.trim()) ||
        (!!barcode?.trim() && !barcodePattern.test(barcode.trim())) ||
        !moneyPattern.test(cost.trim()) ||
        !moneyPattern.test(price.trim()),
    );
    if (invalid) {
      this.error = `Revisa SKU, código, costo y precio de ${invalid.label}.`;
      return;
    }
    const normalizedSkus = this.variants.map(({ sku }) => sku.trim().toLocaleUpperCase());
    if (new Set(normalizedSkus).size !== normalizedSkus.length) {
      this.error = 'Cada variante necesita un SKU diferente.';
      return;
    }
    this.saving = true;
    this.error = null;
    this.success = null;
    this.products
      .updateVariants(this.product.id, {
        version: this.product.version,
        attributes,
        variants: this.variants.map((variant) => ({
          ...(variant.id ? { id: variant.id } : {}),
          ...(variant.version ? { version: variant.version } : {}),
          values: variant.values,
          sku: variant.sku.trim(),
          barcode: variant.barcode?.trim() || undefined,
          cost: variant.cost.trim(),
          price: variant.price.trim(),
          active: variant.active,
        })),
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: ({ data }) => {
          this.product = data;
          this.success = 'Variantes guardadas. Ya pueden recibir stock y venderse por separado.';
          this.saved.emit(data);
          this.ngOnChanges();
          this.success = 'Variantes guardadas. Ya pueden recibir stock y venderse por separado.';
        },
        error: (response: HttpErrorResponse) => {
          this.error =
            typeof response.error?.message === 'string'
              ? response.error.message
              : 'No fue posible guardar las variantes.';
        },
      });
  }

  private parsedAttributes(): Array<{ name: string; values: string[] }> | null {
    const attributes = this.attributes.map(({ name, valuesText }) => ({
      name: name.trim(),
      values: valuesText
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    }));
    if (attributes.some(({ name, values }) => !name || values.length === 0)) {
      this.error = 'Escribe un nombre y al menos un valor separado por comas para cada atributo.';
      return null;
    }
    const names = attributes.map(({ name }) => name.toLocaleUpperCase());
    if (new Set(names).size !== names.length) {
      this.error = 'Los nombres de atributo no pueden repetirse.';
      return null;
    }
    for (const attribute of attributes) {
      const values = attribute.values.map((value) => value.toLocaleUpperCase());
      if (new Set(values).size !== values.length) {
        this.error = `El atributo ${attribute.name} contiene valores repetidos.`;
        return null;
      }
    }
    return attributes;
  }

  private cartesian(values: string[][]): string[][] {
    return values.reduce<string[][]>(
      (combinations, options) =>
        combinations.flatMap((combination) => options.map((option) => [...combination, option])),
      [[]],
    );
  }

  private generatedSku(values: string[], index: number): string {
    const suffix = values
      .map((value) =>
        value
          .normalize('NFKD')
          .replace(/[^A-Za-z0-9]/g, '')
          .toUpperCase(),
      )
      .filter(Boolean)
      .join('-');
    const indexSuffix = String(index + 1);
    const selected = (suffix || 'V').slice(0, Math.max(1, 37 - indexSuffix.length));
    const baseLength = Math.max(1, 38 - selected.length - indexSuffix.length);
    return `${this.product.sku.slice(0, baseLength)}-${selected}-${indexSuffix}`;
  }

  private key(values: string[]): string {
    return values.map((value) => value.normalize('NFKC').toLocaleUpperCase()).join('\u0000');
  }
}
