import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { SupplierFacade } from '../../application/supplier.facade';
import {
  CatalogProductOption,
  Supplier,
  SupplierProduct,
  SupplierProductInput,
} from '../../domain/supplier.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-supplier-product-dialog',
  styleUrl: '../supplier-dialog.scss',
  templateUrl: './supplier-product-dialog.html',
})
export class SupplierProductDialog implements OnInit {
  readonly supplier = input.required<Supplier>();
  readonly link = input<SupplierProduct | null>(null);
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  readonly closed = output<void>();
  readonly submitted = output<SupplierProductInput>();

  private readonly facade: SupplierFacade;
  protected readonly searching = signal(false);
  protected readonly searchError = signal<string | null>(null);
  protected readonly results = signal<readonly CatalogProductOption[]>([]);
  protected readonly selectedProduct = signal<CatalogProductOption | null>(null);
  protected readonly minimumValidFrom = computed(() => {
    const latestDate = this.link()?.prices[0]?.validFrom.slice(0, 10);
    return latestDate ? this.nextDate(latestDate) : undefined;
  });
  protected readonly form = new FormBuilder().nonNullable.group({
    productSearch: [''],
    supplierCode: ['', [Validators.required, Validators.maxLength(64)]],
    currency: ['MXN', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
    unitCost: [
      '',
      [
        Validators.required,
        Validators.pattern(/^(?:[1-9]\d{0,11}(?:\.\d{1,2})?|0\.(?:0[1-9]|[1-9]\d?))$/),
      ],
    ],
    minimumQuantity: [
      '',
      Validators.pattern(/^(?:[1-9]\d{0,11}(?:\.\d{1,3})?|0\.(?:00[1-9]|0[1-9]\d?|[1-9]\d{0,2}))$/),
    ],
    validFrom: [new Date().toISOString().slice(0, 10), Validators.required],
    validTo: [''],
  });

  constructor(facade: SupplierFacade) {
    this.facade = facade;
  }

  ngOnInit(): void {
    const link = this.link();
    if (link) {
      const price = link.prices[0];
      this.selectedProduct.set(link.product);
      this.form.patchValue({
        supplierCode: link.supplierCode,
        currency: price?.currency ?? 'MXN',
        unitCost: price?.unitCost ?? '',
        minimumQuantity: link.minimumQuantity ?? '',
        validFrom: this.minimumValidFrom() ?? new Date().toISOString().slice(0, 10),
        validTo: '',
      });
      return;
    }
    this.searchProducts();
  }

  protected searchProducts(): void {
    if (this.searching()) return;
    this.searching.set(true);
    this.searchError.set(null);
    this.facade
      .searchCatalogProducts(this.form.controls.productSearch.value.trim())
      .pipe(finalize(() => this.searching.set(false)))
      .subscribe({
        next: (page) => this.results.set(page.products),
        error: () => this.searchError.set('No fue posible consultar el catálogo.'),
      });
  }

  protected chooseProduct(product: CatalogProductOption): void {
    this.selectedProduct.set(product);
    if (!this.form.controls.unitCost.value) {
      this.form.controls.unitCost.setValue(product.catalogCost);
    }
  }

  protected changeProduct(): void {
    if (this.link()) return;
    this.selectedProduct.set(null);
  }

  protected submit(): void {
    const product = this.selectedProduct();
    if (!product || this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const minimumValidFrom = this.minimumValidFrom();
    if (minimumValidFrom && value.validFrom < minimumValidFrom) {
      this.form.controls.validFrom.setErrors({ supplierPriceDateConflict: true });
      this.form.controls.validFrom.markAsTouched();
      return;
    }
    if (value.validTo && value.validTo < value.validFrom) {
      this.form.controls.validTo.setErrors({ supplierPriceValidity: true });
      this.form.controls.validTo.markAsTouched();
      return;
    }
    this.submitted.emit({
      supplierId: this.supplier().id,
      productId: product.id,
      supplierCode: value.supplierCode.trim(),
      currency: value.currency.trim().toUpperCase(),
      unitCost: value.unitCost.trim(),
      minimumQuantity: value.minimumQuantity.trim() || undefined,
      validFrom: value.validFrom,
      validTo: value.validTo || undefined,
    });
  }

  private nextDate(dateOnly: string): string {
    const date = new Date(`${dateOnly}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  }
}
