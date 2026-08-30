import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/api/api-error';
import { AuthorizationService } from '../../../../core/authorization/authorization.service';
import { CatalogFacade } from '../../application/catalog.facade';
import {
  CatalogOptions,
  Product,
  ProductBaseUnit,
  ProductPage,
  ProductQuery,
  ProductStatus,
} from '../../domain/catalog.models';
import { CatalogClassificationPanel } from '../classification-panel/classification-panel';
import { ProductImportPanel } from '../product-import-panel/product-import-panel';

type CatalogTab = 'PRODUCTS' | 'CLASSIFICATIONS' | 'IMPORT';
const MONEY_PATTERN = /^(0|[1-9]\d{0,11})(\.\d{1,2})?$/;
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CatalogClassificationPanel, ProductImportPanel, ReactiveFormsModule],
  selector: 'ui-catalog-page',
  styleUrls: ['./catalog-page.scss', './catalog-dialog.scss'],
  templateUrl: './catalog-page.html',
})
export class CatalogPage implements OnInit {
  private readonly catalog = inject(CatalogFacade);
  private readonly authorization = inject(AuthorizationService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private loadRevision = 0;

  protected readonly tab = signal<CatalogTab>('PRODUCTS');
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly page = signal<ProductPage | null>(null);
  protected readonly options = signal<CatalogOptions>({ categories: [], brands: [] });
  protected readonly editing = signal<Product | null>(null);
  protected readonly editorOpen = signal(false);
  protected readonly retirement = signal<Product | null>(null);
  protected readonly retirementConfirmation = signal('');
  protected readonly canManage = computed(() => this.authorization.has('PRODUCTS_MANAGE'));
  protected readonly baseUnits: readonly { value: ProductBaseUnit; label: string }[] = [
    { value: 'UNIT', label: 'Unidad' },
    { value: 'KILOGRAM', label: 'Kilogramo' },
    { value: 'GRAM', label: 'Gramo' },
    { value: 'LITER', label: 'Litro' },
    { value: 'MILLILITER', label: 'Mililitro' },
    { value: 'METER', label: 'Metro' },
    { value: 'CENTIMETER', label: 'Centímetro' },
  ];
  protected readonly filters = this.formBuilder.nonNullable.group({
    q: [''],
    status: ['ACTIVE' as ProductStatus],
    categoryId: [''],
    brandId: [''],
  });
  protected readonly productForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
    withoutCode: [false],
    sku: ['', [Validators.pattern(SKU_PATTERN)]],
    barcode: [''],
    categoryName: [''],
    brandName: [''],
    cost: ['0', [Validators.required, Validators.pattern(MONEY_PATTERN)]],
    price: ['0', [Validators.required, Validators.pattern(MONEY_PATTERN)]],
    stockBehavior: ['TRACKED' as 'TRACKED' | 'UNTRACKED'],
    taxBehavior: ['STANDARD' as 'STANDARD' | 'EXEMPT'],
    baseUnit: ['UNIT' as ProductBaseUnit],
    quantityPrecision: [0, [Validators.required, Validators.min(0), Validators.max(3)]],
    quantityRounding: ['HALF_UP' as 'HALF_UP' | 'DOWN' | 'UP'],
    minimumQuantity: ['1', Validators.required],
    trackLots: [false],
    trackSerials: [false],
  });

  ngOnInit(): void {
    this.catalog.getOptions().subscribe({ next: (options) => this.options.set(options) });
    this.route.queryParamMap.subscribe((params) => {
      const query = this.queryFromUrl(params);
      this.filters.setValue({
        q: query.q ?? '',
        status: query.status,
        categoryId: query.categoryId ?? '',
        brandId: query.brandId ?? '',
      });
      this.load(query);
    });
  }

  protected selectTab(tab: CatalogTab): void {
    if (tab !== 'PRODUCTS' && !this.canManage()) return;
    this.tab.set(tab);
    this.clearMessages();
  }

  protected applyFilters(): void {
    const value = this.filters.getRawValue();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: value.q.trim() || null,
        status: value.status === 'ACTIVE' ? null : value.status,
        categoryId: value.categoryId || null,
        brandId: value.brandId || null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected goToPage(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page <= 1 ? null : page },
      queryParamsHandling: 'merge',
    });
  }

  protected openCreate(): void {
    if (!this.canManage()) return;
    this.clearMessages();
    this.editing.set(null);
    this.productForm.reset({
      name: '',
      withoutCode: false,
      sku: '',
      barcode: '',
      categoryName: '',
      brandName: '',
      cost: '0',
      price: '0',
      stockBehavior: 'TRACKED',
      taxBehavior: 'STANDARD',
      baseUnit: 'UNIT',
      quantityPrecision: 0,
      quantityRounding: 'HALF_UP',
      minimumQuantity: '1',
      trackLots: false,
      trackSerials: false,
    });
    this.editorOpen.set(true);
  }

  protected openEdit(product: Product): void {
    if (!this.canManage()) return;
    this.clearMessages();
    this.editing.set(product);
    this.productForm.reset({
      name: product.name,
      withoutCode: product.withoutCode,
      sku: product.sku,
      barcode: product.barcode ?? '',
      categoryName: product.category?.name ?? '',
      brandName: product.brand?.name ?? '',
      cost: product.cost,
      price: product.price,
      stockBehavior: product.stockBehavior,
      taxBehavior: product.taxBehavior,
      baseUnit: product.baseUnit,
      quantityPrecision: product.quantityPrecision,
      quantityRounding: product.quantityRounding,
      minimumQuantity: product.minimumQuantity,
      trackLots: product.trackLots,
      trackSerials: product.trackSerials,
    });
    this.editorOpen.set(true);
  }

  protected closeEditor(): void {
    if (!this.saving()) this.editorOpen.set(false);
  }

  protected saveProduct(): void {
    if (!this.canManage()) return;
    const withoutCode = this.productForm.controls.withoutCode.value;
    if (!withoutCode && !this.productForm.controls.sku.value.trim()) {
      this.productForm.controls.sku.setErrors({ required: true });
    }
    if (this.productForm.invalid || this.saving()) {
      this.productForm.markAllAsTouched();
      return;
    }
    const current = this.editing();
    this.saving.set(true);
    this.error.set(null);
    this.catalog
      .saveProduct(this.productForm.getRawValue(), current ?? undefined)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.editorOpen.set(false);
          this.notice.set(current ? 'Producto actualizado.' : 'Producto creado.');
          this.refresh();
        },
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected requestRetirement(product: Product): void {
    if (!this.canManage()) return;
    this.clearMessages();
    this.retirementConfirmation.set('');
    this.retirement.set(product);
  }

  protected updateRetirement(event: Event): void {
    this.retirementConfirmation.set((event.target as HTMLInputElement).value);
  }

  protected confirmRetirement(): void {
    if (!this.canManage()) return;
    const product = this.retirement();
    if (!product || this.retirementConfirmation().trim() !== product.name || this.saving()) return;
    this.saving.set(true);
    this.catalog
      .retireProduct(product.id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (outcome) => {
          this.retirement.set(null);
          this.notice.set(
            outcome === 'DELETED'
              ? 'Producto eliminado porque no tenía historial.'
              : 'Producto retirado; su historial se conserva.',
          );
          this.refresh();
        },
        error: (error: unknown) => this.error.set(this.messageFor(error)),
      });
  }

  protected refreshAfterCatalogChange(): void {
    this.catalog.getOptions().subscribe({ next: (options) => this.options.set(options) });
    this.refresh();
  }

  private refresh(): void {
    this.load(this.queryFromUrl(this.route.snapshot.queryParamMap));
  }

  private load(query: ProductQuery): void {
    const revision = ++this.loadRevision;
    this.loading.set(true);
    this.error.set(null);
    this.catalog
      .listProducts(query)
      .pipe(
        finalize(() => {
          if (revision === this.loadRevision) this.loading.set(false);
        }),
      )
      .subscribe({
        next: (page) => {
          if (revision === this.loadRevision) this.page.set(page);
        },
        error: (error: unknown) => {
          if (revision === this.loadRevision) this.error.set(this.messageFor(error));
        },
      });
  }

  private queryFromUrl(params: import('@angular/router').ParamMap): ProductQuery {
    const status = params.get('status');
    const page = Number(params.get('page'));
    return {
      q: params.get('q') ?? undefined,
      status: status === 'ALL' || status === 'INACTIVE' ? status : 'ACTIVE',
      categoryId: params.get('categoryId') ?? undefined,
      brandId: params.get('brandId') ?? undefined,
      page: Number.isInteger(page) && page > 0 ? page : 1,
      pageSize: 20,
    };
  }

  private clearMessages(): void {
    this.error.set(null);
    this.notice.set(null);
  }

  private messageFor(error: unknown): string {
    if (!(error instanceof ApiError)) return 'No fue posible actualizar el catálogo.';
    if (error.kind === 'conflict') {
      return error.code === 'PRODUCT_VERSION_CONFLICT'
        ? 'El producto cambió. Cierra el editor y vuelve a abrirlo.'
        : 'Ya existe un producto o clasificación con esos datos.';
    }
    if (error.kind === 'validation') return 'Revisa los campos marcados.';
    return error.message;
  }
}
