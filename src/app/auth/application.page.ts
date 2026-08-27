import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ProductApiService, ProductData, ProductInput } from '../catalog/product-api.service';
import {
  InventoryApiService,
  InventoryBalanceData,
  InventoryMovementInput,
  InventoryStockItem,
} from '../inventory/inventory-api.service';
import { SessionApiService } from './session-api.service';

const MONEY_PATTERN = /^(0|[1-9]\d{0,11})(\.\d{1,2})?$/;
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
const BARCODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{3,63}$/;
const QUANTITY_PATTERN = /^-?(0|[1-9]\d{0,11})(\.\d{1,3})?$/;

@Component({
  selector: 'app-application-page',
  imports: [ReactiveFormsModule],
  templateUrl: './application.page.html',
  styleUrl: './application.page.scss',
})
export class ApplicationPage implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly products = inject(ProductApiService);
  private readonly inventory = inject(InventoryApiService);
  private readonly sessions = inject(SessionApiService);
  private pendingMovement: { input: InventoryMovementInput; key: string } | null = null;

  protected readonly session = this.sessions.session;
  protected readonly categories = signal<Array<{ id: string; name: string }>>([]);
  protected readonly brands = signal<Array<{ id: string; name: string }>>([]);
  protected readonly createdProduct = signal<ProductData | null>(null);
  protected readonly productList = signal<ProductData[]>([]);
  protected readonly selectedProduct = signal<ProductData | null>(null);
  protected readonly locations = signal<Array<{ id: string; name: string; code: string }>>([]);
  protected readonly stockBalance = signal<InventoryBalanceData | null>(null);
  protected readonly loadingOptions = signal(true);
  protected readonly loadingCatalog = signal(true);
  protected readonly loadingDetail = signal(false);
  protected readonly saving = signal(false);
  protected readonly savingStock = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly catalogError = signal<string | null>(null);
  protected readonly stockError = signal<string | null>(null);
  protected readonly stockSuccess = signal<string | null>(null);
  protected readonly stockList = signal<InventoryStockItem[]>([]);
  protected readonly stockListError = signal<string | null>(null);
  protected readonly loadingStockList = signal(true);
  protected readonly stockPage = signal(1);
  protected readonly stockTotalPages = signal(0);
  protected readonly stockTotal = signal(0);
  protected readonly stockScope = signal<{
    branch: { id: string; name: string };
    warehouse: { id: string; name: string };
  } | null>(null);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(0);
  protected readonly totalProducts = signal(0);
  protected readonly pageSize = 5;
  protected readonly searchForm = this.formBuilder.nonNullable.group({
    q: ['', [Validators.maxLength(80)]],
  });
  protected readonly stockSearchForm = this.formBuilder.nonNullable.group({
    q: ['', [Validators.maxLength(80)]],
  });
  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
    sku: ['', [Validators.required, Validators.pattern(SKU_PATTERN)]],
    barcode: ['', [Validators.pattern(BARCODE_PATTERN)]],
    categoryName: ['', [Validators.minLength(2), Validators.maxLength(80)]],
    brandName: ['', [Validators.minLength(2), Validators.maxLength(120)]],
    cost: ['', [Validators.required, Validators.pattern(MONEY_PATTERN)]],
    price: ['', [Validators.required, Validators.pattern(MONEY_PATTERN)]],
  });
  protected readonly stockForm = this.formBuilder.nonNullable.group({
    locationId: ['', [Validators.required]],
    type: ['INITIAL' as InventoryMovementInput['type'], [Validators.required]],
    quantity: ['', [Validators.required, Validators.pattern(QUANTITY_PATTERN)]],
    reason: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
    reference: ['', [Validators.maxLength(120)]],
  });

  ngOnInit(): void {
    this.loadOptions();
    this.loadLocations();
    this.loadProducts(1);
    this.loadStockList(1);
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);
    this.products
      .create(this.toInput())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.createdProduct.set(data);
          this.selectedProduct.set(data);
          this.form.reset({
            name: '',
            sku: '',
            barcode: '',
            categoryName: data.category?.name ?? '',
            brandName: data.brand?.name ?? '',
            cost: '',
            price: '',
          });
          this.loadOptions();
          this.loadProducts(1);
          this.loadBalance(data.id);
          this.loadStockList(1);
        },
        error: (error: HttpErrorResponse) => this.errorMessage.set(this.messageFor(error)),
      });
  }

  protected logout(): void {
    this.sessions.logout().subscribe({ error: () => undefined });
  }

  protected search(): void {
    if (this.searchForm.invalid) {
      this.searchForm.markAllAsTouched();
      return;
    }
    this.loadProducts(1);
  }

  protected previousPage(): void {
    if (this.page() > 1) this.loadProducts(this.page() - 1);
  }

  protected nextPage(): void {
    if (this.page() < this.totalPages()) this.loadProducts(this.page() + 1);
  }

  protected searchStock(): void {
    if (this.stockSearchForm.invalid) {
      this.stockSearchForm.markAllAsTouched();
      return;
    }
    this.loadStockList(1);
  }

  protected previousStockPage(): void {
    if (this.stockPage() > 1) this.loadStockList(this.stockPage() - 1);
  }

  protected nextStockPage(): void {
    if (this.stockPage() < this.stockTotalPages()) {
      this.loadStockList(this.stockPage() + 1);
    }
  }

  protected selectProduct(id: string): void {
    this.loadingDetail.set(true);
    this.catalogError.set(null);
    this.products
      .get(id)
      .pipe(finalize(() => this.loadingDetail.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.createdProduct.set(null);
          this.selectedProduct.set(data);
          this.loadBalance(data.id);
        },
        error: () => this.catalogError.set('No fue posible consultar el producto.'),
      });
  }

  protected locationChanged(): void {
    const product = this.selectedProduct();
    if (product) this.loadBalance(product.id);
  }

  protected recordMovement(): void {
    const product = this.selectedProduct();
    if (!product || this.stockForm.invalid || this.savingStock()) {
      this.stockForm.markAllAsTouched();
      return;
    }
    const value = this.stockForm.getRawValue();
    if (
      value.quantity === '0' ||
      value.quantity === '0.0' ||
      value.quantity === '0.00' ||
      value.quantity === '0.000'
    ) {
      this.stockError.set('La cantidad debe ser distinta de cero.');
      return;
    }
    if (value.type !== 'ADJUSTMENT' && value.quantity.startsWith('-')) {
      this.stockError.set('El stock inicial y las entradas deben usar una cantidad positiva.');
      return;
    }
    this.savingStock.set(true);
    this.stockError.set(null);
    this.stockSuccess.set(null);
    const input: InventoryMovementInput = {
      productId: product.id,
      locationId: value.locationId,
      type: value.type,
      quantity: value.quantity.trim(),
      reason: value.reason.trim(),
      ...(value.reference.trim() ? { reference: value.reference.trim() } : {}),
    };
    const pending = this.pendingMovement;
    const idempotencyKey =
      pending && JSON.stringify(pending.input) === JSON.stringify(input)
        ? pending.key
        : `web-${globalThis.crypto.randomUUID()}`;
    this.pendingMovement = { input, key: idempotencyKey };
    this.inventory
      .createMovement(input, idempotencyKey)
      .pipe(finalize(() => this.savingStock.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.pendingMovement = null;
          this.stockBalance.set(data);
          this.stockSuccess.set(`Movimiento registrado. Existencia ${data.quantity}.`);
          this.stockForm.reset({
            locationId: data.location.id,
            type: 'ENTRY',
            quantity: '',
            reason: '',
            reference: '',
          });
          this.loadStockList(this.stockPage());
        },
        error: (error: HttpErrorResponse) => {
          if (error.status > 0 && error.status < 500) this.pendingMovement = null;
          this.stockError.set(this.stockMessageFor(error));
        },
      });
  }

  private loadOptions(): void {
    this.loadingOptions.set(true);
    this.products
      .getOptions()
      .pipe(finalize(() => this.loadingOptions.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.categories.set(data.categories);
          this.brands.set(data.brands);
        },
        error: () => this.errorMessage.set('No fue posible cargar categorías y marcas.'),
      });
  }

  private loadLocations(): void {
    this.inventory.listLocations().subscribe({
      next: ({ data }) => {
        this.locations.set(data);
        if (!this.stockForm.controls.locationId.value && data[0]) {
          this.stockForm.controls.locationId.setValue(data[0].id);
        }
        const product = this.selectedProduct();
        if (product) this.loadBalance(product.id);
      },
      error: () => this.stockError.set('No fue posible cargar las ubicaciones.'),
    });
  }

  private loadBalance(productId: string): void {
    const locationId = this.stockForm.controls.locationId.value;
    this.stockSuccess.set(null);
    this.stockError.set(null);
    this.stockBalance.set(null);
    if (!locationId) return;
    this.inventory.getBalance(productId, locationId).subscribe({
      next: ({ data }) => this.stockBalance.set(data),
      error: () => this.stockError.set('No fue posible consultar la existencia.'),
    });
  }

  private loadProducts(page: number): void {
    this.loadingCatalog.set(true);
    this.catalogError.set(null);
    const q = this.searchForm.controls.q.value.trim();
    this.products
      .list({ ...(q ? { q } : {}), page, pageSize: this.pageSize })
      .pipe(finalize(() => this.loadingCatalog.set(false)))
      .subscribe({
        next: ({ data, meta }) => {
          this.productList.set(data);
          this.page.set(meta.pagination.page);
          this.totalPages.set(meta.pagination.totalPages);
          this.totalProducts.set(meta.pagination.total);
        },
        error: () => this.catalogError.set('No fue posible cargar el catálogo.'),
      });
  }

  private loadStockList(page: number): void {
    this.loadingStockList.set(true);
    this.stockListError.set(null);
    const q = this.stockSearchForm.controls.q.value.trim();
    const context = this.session()?.context;
    this.inventory
      .listStock({
        ...(context?.branch?.id ? { branchId: context.branch.id } : {}),
        ...(context?.warehouse?.id ? { warehouseId: context.warehouse.id } : {}),
        ...(q ? { q } : {}),
        page,
        pageSize: 10,
      })
      .pipe(finalize(() => this.loadingStockList.set(false)))
      .subscribe({
        next: ({ data, meta }) => {
          this.stockList.set(data);
          this.stockScope.set(meta.scope);
          this.stockPage.set(meta.pagination.page);
          this.stockTotalPages.set(meta.pagination.totalPages);
          this.stockTotal.set(meta.pagination.total);
        },
        error: () => this.stockListError.set('No fue posible cargar las existencias.'),
      });
  }

  private toInput(): ProductInput {
    const value = this.form.getRawValue();
    return {
      name: value.name.trim(),
      sku: value.sku.trim(),
      ...(value.barcode.trim() ? { barcode: value.barcode.trim() } : {}),
      ...(value.categoryName.trim() ? { categoryName: value.categoryName.trim() } : {}),
      ...(value.brandName.trim() ? { brandName: value.brandName.trim() } : {}),
      cost: value.cost.trim(),
      price: value.price.trim(),
    };
  }

  private messageFor(error: HttpErrorResponse): string {
    const code = (error.error as { code?: string } | null)?.code;
    if (code === 'SKU_ALREADY_EXISTS') return 'Ya existe un producto con ese SKU.';
    if (code === 'BARCODE_ALREADY_EXISTS') {
      return 'Ya existe un producto con ese código de barras.';
    }
    if (error.status === 0) return 'No pudimos conectar con el servicio. Intenta nuevamente.';
    return 'No fue posible crear el producto con esos datos.';
  }

  private stockMessageFor(error: HttpErrorResponse): string {
    const code = (error.error as { code?: string } | null)?.code;
    if (code === 'INITIAL_STOCK_ALREADY_EXISTS') {
      return 'El stock inicial ya fue registrado; usa entrada o ajuste.';
    }
    if (code === 'INVALID_STOCK_QUANTITY') {
      return 'La cantidad es inválida o dejaría la existencia negativa.';
    }
    if (error.status === 0) return 'No pudimos conectar con el servicio. Intenta nuevamente.';
    return 'No fue posible registrar el movimiento.';
  }
}
