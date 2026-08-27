import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ProductApiService, ProductData } from '../catalog/product-api.service';
import {
  SupplierProductApiService,
  SupplierProductData,
  SupplierProductInput,
} from './supplier-product-api.service';
import {
  SupplierApiService,
  SupplierContactInput,
  SupplierData,
  SupplierInput,
  SupplierStatusFilter,
} from './supplier-api.service';

@Component({
  selector: 'app-supplier-panel',
  imports: [ReactiveFormsModule],
  templateUrl: './supplier-panel.component.html',
  styleUrl: './supplier-panel.component.scss',
})
export class SupplierPanelComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(SupplierApiService);
  private readonly productApi = inject(ProductApiService);
  private readonly supplierProductApi = inject(SupplierProductApiService);

  protected readonly suppliers = signal<SupplierData[]>([]);
  protected readonly editing = signal<SupplierData | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly deactivatingId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(0);
  protected readonly total = signal(0);
  protected readonly supplierOptions = signal<SupplierData[]>([]);
  protected readonly productOptions = signal<ProductData[]>([]);
  protected readonly supplierProducts = signal<SupplierProductData[]>([]);
  protected readonly editingSupplierProduct = signal<SupplierProductData | null>(null);
  protected readonly supplierProductLoading = signal(true);
  protected readonly supplierProductSaving = signal(false);
  protected readonly supplierProductPage = signal(1);
  protected readonly supplierProductTotalPages = signal(0);
  protected readonly supplierProductTotal = signal(0);
  protected readonly searchForm = this.formBuilder.nonNullable.group({
    q: ['', [Validators.maxLength(100)]],
    status: ['ACTIVE' as SupplierStatusFilter],
  });
  protected readonly form = this.formBuilder.nonNullable.group({
    legalName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(180)]],
    tradeName: ['', [Validators.maxLength(180)]],
    taxIdentifier: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(64)]],
    contacts: this.formBuilder.array([this.contactGroup()]),
  });
  protected readonly supplierProductSearchForm = this.formBuilder.nonNullable.group({
    q: ['', [Validators.maxLength(100)]],
  });
  protected readonly supplierProductForm = this.formBuilder.nonNullable.group({
    supplierId: ['', [Validators.required]],
    productId: ['', [Validators.required]],
    supplierCode: ['', [Validators.required, Validators.maxLength(64)]],
    currency: ['MXN', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
    unitCost: [
      '',
      [
        Validators.required,
        Validators.pattern(/^(?:[1-9]\d*(?:\.\d{1,2})?|0\.(?:0[1-9]|[1-9]\d?))$/),
      ],
    ],
    minimumQuantity: [
      '',
      [Validators.pattern(/^(?:[1-9]\d*(?:\.\d{1,3})?|0\.(?:00[1-9]|0[1-9]\d?|[1-9]\d{0,2}))$/)],
    ],
    validFrom: [new Date().toISOString().slice(0, 10), [Validators.required]],
    validTo: [''],
  });

  protected get contacts(): FormArray<ReturnType<SupplierPanelComponent['contactGroup']>> {
    return this.form.controls.contacts;
  }

  ngOnInit(): void {
    this.load(1);
    this.loadSupplierProductOptions();
    this.loadSupplierProducts(1);
  }

  protected addContact(): void {
    if (this.contacts.length < 20) this.contacts.push(this.contactGroup());
  }

  protected removeContact(index: number): void {
    if (this.contacts.length > 1) this.contacts.removeAt(index);
  }

  protected filter(): void {
    this.load(1);
  }

  protected previousPage(): void {
    if (this.page() > 1) this.load(this.page() - 1);
  }

  protected nextPage(): void {
    if (this.page() < this.totalPages()) this.load(this.page() + 1);
  }

  protected filterSupplierProducts(): void {
    this.loadSupplierProducts(1);
  }

  protected previousSupplierProductPage(): void {
    if (this.supplierProductPage() > 1) this.loadSupplierProducts(this.supplierProductPage() - 1);
  }

  protected nextSupplierProductPage(): void {
    if (this.supplierProductPage() < this.supplierProductTotalPages())
      this.loadSupplierProducts(this.supplierProductPage() + 1);
  }

  protected editSupplierProduct(link: SupplierProductData): void {
    const currentPrice = link.prices[0];
    this.editingSupplierProduct.set(link);
    this.supplierProductForm.controls.supplierId.disable();
    this.supplierProductForm.controls.productId.disable();
    this.supplierProductForm.setValue({
      supplierId: link.supplier.id,
      productId: link.product.id,
      supplierCode: link.supplierCode,
      currency: currentPrice.currency,
      unitCost: currentPrice.unitCost,
      minimumQuantity: link.minimumQuantity ?? '',
      validFrom: '',
      validTo: '',
    });
    this.error.set(null);
    this.success.set(null);
  }

  protected cancelSupplierProductEditing(): void {
    this.editingSupplierProduct.set(null);
    this.resetSupplierProductForm();
  }

  protected submitSupplierProduct(): void {
    if (this.supplierProductForm.invalid || this.supplierProductSaving()) {
      this.supplierProductForm.markAllAsTouched();
      return;
    }
    const raw = this.supplierProductForm.getRawValue();
    const input: SupplierProductInput = {
      supplierId: raw.supplierId,
      productId: raw.productId,
      supplierCode: raw.supplierCode.trim(),
      currency: raw.currency.trim().toUpperCase(),
      unitCost: raw.unitCost.trim(),
      ...(raw.minimumQuantity.trim() ? { minimumQuantity: raw.minimumQuantity.trim() } : {}),
      validFrom: raw.validFrom,
      ...(raw.validTo ? { validTo: raw.validTo } : {}),
    };
    const current = this.editingSupplierProduct();
    this.supplierProductSaving.set(true);
    this.error.set(null);
    this.success.set(null);
    const operation = current
      ? this.supplierProductApi.update(current.id, { ...input, version: current.version })
      : this.supplierProductApi.create(input);
    operation.pipe(finalize(() => this.supplierProductSaving.set(false))).subscribe({
      next: () => {
        this.success.set(current ? 'Precio de proveedor actualizado.' : 'Producto relacionado.');
        this.editingSupplierProduct.set(null);
        this.resetSupplierProductForm();
        this.loadSupplierProducts(1);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(this.message(error));
        if (error.error?.code === 'SUPPLIER_PRODUCT_VERSION_CONFLICT')
          this.loadSupplierProducts(this.supplierProductPage());
      },
    });
  }

  protected edit(supplier: SupplierData): void {
    this.editing.set(supplier);
    this.form.patchValue({
      legalName: supplier.legalName,
      tradeName: supplier.tradeName ?? '',
      taxIdentifier: supplier.taxIdentifier,
    });
    this.contacts.clear();
    for (const contact of supplier.contacts) {
      this.contacts.push(
        this.contactGroup({
          name: contact.name,
          email: contact.email ?? '',
          phone: contact.phone ?? '',
          role: contact.role ?? '',
          primary: contact.primary,
        }),
      );
    }
    if (this.contacts.length === 0) this.contacts.push(this.contactGroup());
    this.error.set(null);
    this.success.set(null);
  }

  protected cancelEditing(): void {
    this.editing.set(null);
    this.resetForm();
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const contacts = this.form.controls.contacts.getRawValue();
    const usableContacts = contacts.filter(
      (contact) => contact.email.trim() || contact.phone.trim(),
    );
    if (usableContacts.length !== contacts.length) {
      this.error.set('Cada contacto requiere correo o teléfono.');
      return;
    }
    if (usableContacts.filter((contact) => contact.primary).length > 1) {
      this.error.set('Sólo un contacto puede ser principal.');
      return;
    }
    const raw = this.form.getRawValue();
    const input: SupplierInput = {
      legalName: raw.legalName.trim(),
      ...(raw.tradeName.trim() ? { tradeName: raw.tradeName.trim() } : {}),
      taxIdentifier: raw.taxIdentifier.trim(),
      contacts: usableContacts.map((contact): SupplierContactInput => ({
        name: contact.name.trim(),
        ...(contact.email.trim() ? { email: contact.email.trim() } : {}),
        ...(contact.phone.trim() ? { phone: contact.phone.trim() } : {}),
        ...(contact.role.trim() ? { role: contact.role.trim() } : {}),
        primary: contact.primary,
      })),
    };
    const current = this.editing();
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    const operation = current
      ? this.api.update(current.id, { ...input, version: current.version })
      : this.api.create(input);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.success.set(current ? 'Proveedor actualizado.' : 'Proveedor creado.');
        this.editing.set(null);
        this.resetForm();
        this.load(1);
        this.loadSupplierProductOptions();
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(this.message(error));
        if (error.error?.code === 'SUPPLIER_VERSION_CONFLICT') this.load(this.page());
      },
    });
  }

  protected deactivate(supplier: SupplierData): void {
    if (!supplier.active || this.deactivatingId()) return;
    this.deactivatingId.set(supplier.id);
    this.error.set(null);
    this.success.set(null);
    this.api
      .deactivate(supplier.id)
      .pipe(finalize(() => this.deactivatingId.set(null)))
      .subscribe({
        next: () => {
          this.success.set('Proveedor desactivado; su historial se conserva.');
          if (this.editing()?.id === supplier.id) this.cancelEditing();
          this.load(1);
          this.loadSupplierProductOptions();
        },
        error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
      });
  }

  private load(page: number): void {
    this.loading.set(true);
    this.error.set(null);
    const search = this.searchForm.getRawValue();
    this.api
      .list({
        ...(search.q.trim() ? { q: search.q.trim() } : {}),
        status: search.status,
        page,
        pageSize: 10,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ data, meta }) => {
          this.suppliers.set(data);
          this.page.set(meta.pagination.page);
          this.totalPages.set(meta.pagination.totalPages);
          this.total.set(meta.pagination.total);
        },
        error: (error: HttpErrorResponse) => {
          this.suppliers.set([]);
          this.error.set(this.message(error));
        },
      });
  }

  private loadSupplierProductOptions(): void {
    this.api.list({ status: 'ACTIVE', page: 1, pageSize: 100 }).subscribe({
      next: ({ data }) => this.supplierOptions.set(data),
      error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
    });
    this.productApi.list({ status: 'ACTIVE', page: 1, pageSize: 100 }).subscribe({
      next: ({ data }) => this.productOptions.set(data),
      error: (error: HttpErrorResponse) => this.error.set(this.message(error)),
    });
  }

  private loadSupplierProducts(page: number): void {
    this.supplierProductLoading.set(true);
    const query = this.supplierProductSearchForm.controls.q.value.trim();
    this.supplierProductApi
      .list({ ...(query ? { q: query } : {}), page, pageSize: 10 })
      .pipe(finalize(() => this.supplierProductLoading.set(false)))
      .subscribe({
        next: ({ data, meta }) => {
          this.supplierProducts.set(data);
          this.supplierProductPage.set(meta.pagination.page);
          this.supplierProductTotalPages.set(meta.pagination.totalPages);
          this.supplierProductTotal.set(meta.pagination.total);
        },
        error: (error: HttpErrorResponse) => {
          this.supplierProducts.set([]);
          this.error.set(this.message(error));
        },
      });
  }

  private contactGroup(value?: Partial<SupplierContactInput>) {
    return this.formBuilder.nonNullable.group({
      name: [
        value?.name ?? '',
        [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
      ],
      email: [value?.email ?? '', [Validators.email, Validators.maxLength(254)]],
      phone: [value?.phone ?? '', [Validators.maxLength(40)]],
      role: [value?.role ?? '', [Validators.maxLength(80)]],
      primary: [value?.primary ?? false],
    });
  }

  private resetForm(): void {
    this.form.reset({ legalName: '', tradeName: '', taxIdentifier: '' });
    this.contacts.clear();
    this.contacts.push(this.contactGroup());
  }

  private resetSupplierProductForm(): void {
    this.supplierProductForm.controls.supplierId.enable();
    this.supplierProductForm.controls.productId.enable();
    this.supplierProductForm.reset({
      supplierId: '',
      productId: '',
      supplierCode: '',
      currency: 'MXN',
      unitCost: '',
      minimumQuantity: '',
      validFrom: new Date().toISOString().slice(0, 10),
      validTo: '',
    });
  }

  private message(error: HttpErrorResponse): string {
    if (typeof error.error?.message === 'string') return error.error.message;
    if (error.status === 0) return 'No fue posible conectar con el servicio de proveedores.';
    return 'No fue posible completar la operación de proveedores.';
  }
}
