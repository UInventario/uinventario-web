import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { SupplierFacade } from '../../application/supplier.facade';
import {
  Supplier,
  SupplierInput,
  SupplierPage as SupplierPageData,
  SupplierProduct,
  SupplierProductInput,
  SupplierProductPage,
  SupplierQuery,
  SupplierStatus,
} from '../../domain/supplier.models';
import { SupplierDetail, SupplierDetailTab } from '../supplier-detail/supplier-detail';
import { SupplierEditorDialog } from '../supplier-editor-dialog/supplier-editor-dialog';
import { SupplierList } from '../supplier-list/supplier-list';
import { SupplierProductDialog } from '../supplier-product-dialog/supplier-product-dialog';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    SupplierDetail,
    SupplierEditorDialog,
    SupplierList,
    SupplierProductDialog,
  ],
  selector: 'ui-supplier-page',
  styleUrls: ['./supplier-page.scss', './supplier-responsive.scss'],
  templateUrl: './supplier-page.html',
})
export class SupplierPage implements OnInit {
  private readonly facade = inject(SupplierFacade);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private listRevision = 0;
  private detailRevision = 0;
  private productRevision = 0;
  private listKey = '';
  private detailKey = '';
  private productKey = '';

  protected readonly loading = signal(true);
  protected readonly detailLoading = signal(false);
  protected readonly productsLoading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly page = signal<SupplierPageData | null>(null);
  protected readonly selected = signal<Supplier | null>(null);
  protected readonly tab = signal<SupplierDetailTab>('CONTACTS');
  protected readonly products = signal<SupplierProductPage | null>(null);
  protected readonly productFilter = signal('');
  protected readonly editor = signal<Supplier | null | undefined>(undefined);
  protected readonly productEditor = signal<SupplierProduct | null | undefined>(undefined);
  protected readonly retirement = signal<Supplier | null>(null);
  protected readonly retirementConfirmation = signal('');
  protected readonly filters = this.formBuilder.nonNullable.group({
    q: [''],
    status: ['ACTIVE' as SupplierStatus],
  });

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => this.syncFrom(params));
  }

  protected applyFilters(): void {
    const value = this.filters.getRawValue();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: value.q.trim() || null,
        status: value.status === 'ACTIVE' ? null : value.status,
        page: null,
        supplier: null,
        view: null,
        productQ: null,
        productPage: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected goToPage(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page <= 1 ? null : page, supplier: null, view: null },
      queryParamsHandling: 'merge',
    });
  }

  protected selectSupplier(supplier: Supplier): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        supplier: supplier.id,
        view: null,
        productQ: null,
        productPage: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected clearSelection(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        supplier: null,
        view: null,
        productQ: null,
        productPage: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected selectTab(tab: SupplierDetailTab): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: tab === 'PRODUCTS' ? 'productos' : null },
      queryParamsHandling: 'merge',
    });
  }

  protected applyProductFilter(value: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { productQ: value.trim() || null, productPage: null, view: 'productos' },
      queryParamsHandling: 'merge',
    });
  }

  protected goToProductPage(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { productPage: page <= 1 ? null : page, view: 'productos' },
      queryParamsHandling: 'merge',
    });
  }

  protected openCreate(): void {
    this.clearMessages();
    this.editor.set(null);
  }

  protected openEdit(supplier: Supplier): void {
    this.clearMessages();
    this.editor.set(supplier);
  }

  protected saveSupplier(input: SupplierInput): void {
    const current = this.editor() ?? undefined;
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.facade
      .save(input, current)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (supplier) => {
          this.editor.set(undefined);
          this.notice.set(current ? 'Proveedor actualizado.' : 'Proveedor creado.');
          if (!current) {
            void this.router.navigate([], {
              relativeTo: this.route,
              queryParams: { supplier: supplier.id },
              queryParamsHandling: 'merge',
            });
          }
          this.refresh();
        },
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected requestRetirement(supplier: Supplier): void {
    this.clearMessages();
    this.retirementConfirmation.set('');
    this.retirement.set(supplier);
  }

  protected updateRetirementConfirmation(event: Event): void {
    this.retirementConfirmation.set((event.target as HTMLInputElement).value);
  }

  protected confirmRetirement(): void {
    const supplier = this.retirement();
    if (!supplier || this.retirementConfirmation().trim() !== supplier.legalName || this.saving())
      return;
    this.saving.set(true);
    this.error.set(null);
    this.facade
      .deactivate(supplier.id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.retirement.set(null);
          this.notice.set('Proveedor retirado; contactos, precios e historial se conservan.');
          this.refresh();
        },
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected openCreateProduct(): void {
    if (!this.selected()?.active) return;
    this.clearMessages();
    this.productEditor.set(null);
  }

  protected openEditProduct(link: SupplierProduct): void {
    if (this.saving()) return;
    this.clearMessages();
    this.saving.set(true);
    this.facade
      .getProduct(link.id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (current) => this.productEditor.set(current),
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected saveProduct(input: SupplierProductInput): void {
    const current = this.productEditor() ?? undefined;
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.facade
      .saveProduct(input, current)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.productEditor.set(undefined);
          this.notice.set(current ? 'Referencia y costo actualizados.' : 'Producto asignado.');
          this.productKey = '';
          this.loadProductsFrom(this.route.snapshot.queryParamMap);
        },
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  private syncFrom(params: ParamMap): void {
    const query = this.supplierQueryFrom(params);
    this.filters.setValue({ q: query.q ?? '', status: query.status });
    const nextListKey = JSON.stringify(query);
    if (nextListKey !== this.listKey) {
      this.listKey = nextListKey;
      this.loadSuppliers(query);
    }

    const supplierId = params.get('supplier') ?? '';
    if (supplierId !== this.detailKey) {
      this.detailKey = supplierId;
      this.selected.set(null);
      this.products.set(null);
      if (supplierId) this.loadSupplier(supplierId);
    }

    const nextTab = params.get('view') === 'productos' ? 'PRODUCTS' : 'CONTACTS';
    this.tab.set(nextTab);
    this.productFilter.set(params.get('productQ') ?? '');
    if (nextTab === 'PRODUCTS' && supplierId) this.loadProductsFrom(params);
  }

  private supplierQueryFrom(params: ParamMap): SupplierQuery {
    const status = params.get('status');
    const page = Number(params.get('page'));
    return {
      q: params.get('q') ?? undefined,
      status: status === 'INACTIVE' || status === 'ALL' ? status : 'ACTIVE',
      page: Number.isInteger(page) && page > 0 ? page : 1,
      pageSize: 20,
    };
  }

  private loadSuppliers(query: SupplierQuery): void {
    const revision = ++this.listRevision;
    this.loading.set(true);
    this.error.set(null);
    this.facade
      .list(query)
      .pipe(finalize(() => revision === this.listRevision && this.loading.set(false)))
      .subscribe({
        next: (page) => revision === this.listRevision && this.page.set(page),
        error: (error: unknown) =>
          revision === this.listRevision && this.error.set(this.messageFor(error)),
      });
  }

  private loadSupplier(id: string): void {
    const revision = ++this.detailRevision;
    this.detailLoading.set(true);
    this.facade
      .get(id)
      .pipe(finalize(() => revision === this.detailRevision && this.detailLoading.set(false)))
      .subscribe({
        next: (supplier) => revision === this.detailRevision && this.selected.set(supplier),
        error: (error: unknown) =>
          revision === this.detailRevision && this.error.set(this.messageFor(error)),
      });
  }

  private loadProductsFrom(params: ParamMap): void {
    const supplierId = params.get('supplier');
    if (!supplierId) return;
    const page = Number(params.get('productPage'));
    const query = {
      supplierId,
      q: params.get('productQ') ?? undefined,
      page: Number.isInteger(page) && page > 0 ? page : 1,
      pageSize: 10,
    };
    const nextKey = JSON.stringify(query);
    if (nextKey === this.productKey) return;
    this.productKey = nextKey;
    const revision = ++this.productRevision;
    this.productsLoading.set(true);
    this.facade
      .listProducts(query)
      .pipe(finalize(() => revision === this.productRevision && this.productsLoading.set(false)))
      .subscribe({
        next: (products) => revision === this.productRevision && this.products.set(products),
        error: (error: unknown) =>
          revision === this.productRevision && this.error.set(this.messageFor(error)),
      });
  }

  private refresh(): void {
    this.listKey = '';
    this.detailKey = '';
    this.productKey = '';
    this.syncFrom(this.route.snapshot.queryParamMap);
  }

  private clearMessages(): void {
    this.error.set(null);
    this.notice.set(null);
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible actualizar proveedores.';
    const messages: Record<string, string> = {
      TENANT_COUNTRY_REQUIRED: 'Configura el país de la empresa antes de crear proveedores.',
      INVALID_SUPPLIER_TAX_IDENTIFIER: 'La identificación fiscal no corresponde al país.',
      MULTIPLE_PRIMARY_SUPPLIER_CONTACTS: 'Sólo un contacto puede ser principal.',
      SUPPLIER_IDENTIFIER_ALREADY_EXISTS: 'Ya existe un proveedor con esa identificación.',
      SUPPLIER_VERSION_CONFLICT: 'El proveedor cambió. Vuelve a abrirlo antes de guardar.',
      SUPPLIER_PRODUCT_ALREADY_EXISTS: 'Ese producto ya está relacionado con el proveedor.',
      SUPPLIER_CODE_ALREADY_EXISTS: 'Ese código ya se usa para otro producto del proveedor.',
      SUPPLIER_PRICE_DATE_CONFLICT: 'La nueva vigencia debe iniciar después del último precio.',
      SUPPLIER_PRODUCT_VERSION_CONFLICT: 'La relación cambió. Vuelve a abrirla antes de guardar.',
      INVALID_SUPPLIER_PRICE_VALIDITY: 'La vigencia final no puede ser anterior a la inicial.',
    };
    return (error.code && messages[error.code]) || error.message;
  }
}
