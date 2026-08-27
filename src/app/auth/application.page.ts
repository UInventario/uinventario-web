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
import {
  CashSaleData,
  PosApiService,
  PosCartQuote,
  SaleDetailData,
  SaleSummaryData,
} from '../pos/pos-api.service';

const MONEY_PATTERN = /^(0|[1-9]\d{0,11})(\.\d{1,2})?$/;
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
const BARCODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{3,63}$/;
const QUANTITY_PATTERN = /^-?(0|[1-9]\d{0,11})(\.\d{1,3})?$/;
const CART_QUANTITY_PATTERN = /^(0|[1-9]\d{0,8})(\.\d{1,3})?$/;

interface CartEntry {
  product: ProductData;
  quantity: string;
}

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
  private readonly pos = inject(PosApiService);
  private pendingMovement: { input: InventoryMovementInput; key: string } | null = null;
  private pendingSale: {
    input: { lines: Array<{ productId: string; quantity: string }>; cashReceived: string };
    key: string;
  } | null = null;

  protected readonly session = this.sessions.session;
  protected readonly categories = signal<Array<{ id: string; name: string }>>([]);
  protected readonly brands = signal<Array<{ id: string; name: string }>>([]);
  protected readonly createdProduct = signal<ProductData | null>(null);
  protected readonly editingProduct = signal<ProductData | null>(null);
  protected readonly updatedProduct = signal(false);
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
  protected readonly posResults = signal<ProductData[]>([]);
  protected readonly cart = signal<CartEntry[]>([]);
  protected readonly cartQuote = signal<PosCartQuote | null>(null);
  protected readonly completedSale = signal<CashSaleData | null>(null);
  protected readonly searchingPos = signal(false);
  protected readonly quotingCart = signal(false);
  protected readonly savingSale = signal(false);
  protected readonly posError = signal<string | null>(null);
  protected readonly salesHistory = signal<SaleSummaryData[]>([]);
  protected readonly selectedSale = signal<SaleDetailData | null>(null);
  protected readonly loadingSales = signal(true);
  protected readonly loadingSaleDetail = signal(false);
  protected readonly salesError = signal<string | null>(null);
  protected readonly salesPage = signal(1);
  protected readonly salesTotalPages = signal(0);
  protected readonly salesTotal = signal(0);
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
  protected readonly posSearchForm = this.formBuilder.nonNullable.group({
    q: ['', [Validators.required, Validators.maxLength(80)]],
  });
  protected readonly cashForm = this.formBuilder.nonNullable.group({
    cashReceived: ['', [Validators.required, Validators.pattern(MONEY_PATTERN)]],
  });
  protected readonly salesFilterForm = this.formBuilder.nonNullable.group({
    dateFrom: [''],
    dateTo: [''],
    cashRegisterId: [''],
    userId: [''],
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
    this.loadSales(1);
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);
    const editing = this.editingProduct();
    const operation = editing
      ? this.products.update(editing.id, { ...this.toInput(), version: editing.version })
      : this.products.create(this.toInput());
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: ({ data }) => {
        this.createdProduct.set(editing ? null : data);
        this.updatedProduct.set(Boolean(editing));
        this.editingProduct.set(null);
        this.selectedProduct.set(data);
        this.resetProductForm(data);
        this.loadOptions();
        this.loadProducts(1);
        this.loadBalance(data.id);
        this.loadStockList(1);
      },
      error: (error: HttpErrorResponse) => this.errorMessage.set(this.messageFor(error)),
    });
  }

  protected startEditing(product: ProductData): void {
    this.createdProduct.set(null);
    this.updatedProduct.set(false);
    this.errorMessage.set(null);
    this.editingProduct.set(product);
    this.form.reset({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode ?? '',
      categoryName: product.category?.name ?? '',
      brandName: product.brand?.name ?? '',
      cost: product.cost,
      price: product.price,
    });
  }

  protected cancelEditing(): void {
    this.editingProduct.set(null);
    this.errorMessage.set(null);
    this.resetProductForm(this.selectedProduct());
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

  protected searchPos(): void {
    if (this.posSearchForm.invalid || this.searchingPos()) {
      this.posSearchForm.markAllAsTouched();
      return;
    }
    this.searchingPos.set(true);
    this.posError.set(null);
    this.products
      .list({ q: this.posSearchForm.controls.q.value.trim(), page: 1, pageSize: 5 })
      .pipe(finalize(() => this.searchingPos.set(false)))
      .subscribe({
        next: ({ data }) => this.posResults.set(data),
        error: () => this.posError.set('No fue posible buscar productos para la venta.'),
      });
  }

  protected addToCart(product: ProductData): void {
    if (!product.active) {
      this.posError.set('El producto está inactivo y no puede venderse.');
      return;
    }
    const existing = this.cart().find((entry) => entry.product.id === product.id);
    this.resetCompletedSale();
    this.cart.set(
      existing
        ? this.cart().map((entry) =>
            entry.product.id === product.id
              ? { ...entry, quantity: String(Number(entry.quantity) + 1) }
              : entry,
          )
        : [...this.cart(), { product, quantity: '1' }],
    );
    this.quoteCart();
  }

  protected updateCartQuantity(productId: string, quantity: string): void {
    const normalized = quantity.trim();
    if (!CART_QUANTITY_PATTERN.test(normalized) || Number(normalized) <= 0) {
      this.posError.set('La cantidad del carrito debe ser mayor que cero.');
      return;
    }
    this.resetCompletedSale();
    this.cart.set(
      this.cart().map((entry) =>
        entry.product.id === productId ? { ...entry, quantity: normalized } : entry,
      ),
    );
    this.quoteCart();
  }

  protected removeFromCart(productId: string): void {
    this.resetCompletedSale();
    this.cart.set(this.cart().filter((entry) => entry.product.id !== productId));
    if (this.cart().length === 0) {
      this.cartQuote.set(null);
      this.posError.set(null);
      return;
    }
    this.quoteCart();
  }

  protected quotedLine(productId: string) {
    return this.cartQuote()?.lines.find((line) => line.product.id === productId) ?? null;
  }

  protected taxPercent(rate: string): string {
    return `${Number(rate) * 100}%`;
  }

  protected completeCashSale(): void {
    const quote = this.cartQuote();
    if (!quote || this.cashForm.invalid || this.savingSale()) {
      this.cashForm.markAllAsTouched();
      return;
    }
    const input = {
      lines: this.cart().map((entry) => ({
        productId: entry.product.id,
        quantity: entry.quantity,
      })),
      cashReceived: this.cashForm.controls.cashReceived.value.trim(),
    };
    const pending = this.pendingSale;
    const idempotencyKey =
      pending && JSON.stringify(pending.input) === JSON.stringify(input)
        ? pending.key
        : `web-sale-${globalThis.crypto.randomUUID()}`;
    this.pendingSale = { input, key: idempotencyKey };
    this.savingSale.set(true);
    this.posError.set(null);
    this.pos
      .createCashSale(input, idempotencyKey)
      .pipe(finalize(() => this.savingSale.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.pendingSale = null;
          this.completedSale.set(data);
          this.cart.set([]);
          this.cartQuote.set(null);
          this.cashForm.reset({ cashReceived: '' });
          this.loadStockList(this.stockPage());
          this.loadSales(1);
          const selected = this.selectedProduct();
          if (selected) this.loadBalance(selected.id);
        },
        error: (error: HttpErrorResponse) => {
          if (error.status > 0 && error.status < 500) this.pendingSale = null;
          this.posError.set(this.posMessageFor(error));
        },
      });
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
          this.updatedProduct.set(false);
          this.editingProduct.set(null);
          this.selectedProduct.set(data);
          this.loadBalance(data.id);
        },
        error: () => this.catalogError.set('No fue posible consultar el producto.'),
      });
  }

  protected filterSales(): void {
    this.loadSales(1);
  }

  protected previousSalesPage(): void {
    if (this.salesPage() > 1) this.loadSales(this.salesPage() - 1);
  }

  protected nextSalesPage(): void {
    if (this.salesPage() < this.salesTotalPages()) {
      this.loadSales(this.salesPage() + 1);
    }
  }

  protected selectSale(id: string): void {
    this.loadingSaleDetail.set(true);
    this.salesError.set(null);
    this.pos
      .getSale(id)
      .pipe(finalize(() => this.loadingSaleDetail.set(false)))
      .subscribe({
        next: ({ data }) => this.selectedSale.set(data),
        error: () => {
          this.selectedSale.set(null);
          this.salesError.set('No fue posible consultar el detalle de la venta.');
        },
      });
  }

  protected dateTime(value: string): string {
    return new Date(value).toLocaleString('es-MX');
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

  private loadSales(page: number): void {
    this.loadingSales.set(true);
    this.salesError.set(null);
    const value = this.salesFilterForm.getRawValue();
    this.pos
      .listSales({
        ...(value.dateFrom ? { dateFrom: value.dateFrom } : {}),
        ...(value.dateTo ? { dateTo: value.dateTo } : {}),
        ...(value.cashRegisterId ? { cashRegisterId: value.cashRegisterId } : {}),
        ...(value.userId ? { userId: value.userId } : {}),
        page,
        pageSize: 10,
      })
      .pipe(finalize(() => this.loadingSales.set(false)))
      .subscribe({
        next: ({ data, meta }) => {
          this.salesHistory.set(data);
          this.salesPage.set(meta.pagination.page);
          this.salesTotalPages.set(meta.pagination.totalPages);
          this.salesTotal.set(meta.pagination.total);
          if (data[0] && !this.selectedSale()) this.selectSale(data[0].id);
          if (data.length === 0) this.selectedSale.set(null);
        },
        error: () => {
          this.salesHistory.set([]);
          this.selectedSale.set(null);
          this.salesError.set('No fue posible cargar el historial de ventas.');
        },
      });
  }

  private quoteCart(): void {
    if (this.cart().length === 0) return;
    this.quotingCart.set(true);
    this.posError.set(null);
    this.pos
      .quote(
        this.cart().map((entry) => ({
          productId: entry.product.id,
          quantity: entry.quantity,
        })),
      )
      .pipe(finalize(() => this.quotingCart.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.cartQuote.set(data);
          this.cashForm.controls.cashReceived.setValue(data.totals.total);
        },
        error: (error: HttpErrorResponse) => {
          this.cartQuote.set(null);
          this.posError.set(this.posMessageFor(error));
        },
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

  private resetProductForm(product: ProductData | null): void {
    this.form.reset({
      name: '',
      sku: '',
      barcode: '',
      categoryName: product?.category?.name ?? '',
      brandName: product?.brand?.name ?? '',
      cost: '',
      price: '',
    });
  }

  private messageFor(error: HttpErrorResponse): string {
    const code = (error.error as { code?: string } | null)?.code;
    if (code === 'SKU_ALREADY_EXISTS') return 'Ya existe un producto con ese SKU.';
    if (code === 'BARCODE_ALREADY_EXISTS') {
      return 'Ya existe un producto con ese código de barras.';
    }
    if (code === 'PRODUCT_VERSION_CONFLICT') {
      return 'El producto cambió desde que lo abriste. Cancela y vuelve a abrirlo antes de guardar.';
    }
    if (error.status === 0) return 'No pudimos conectar con el servicio. Intenta nuevamente.';
    return 'No fue posible guardar el producto con esos datos.';
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

  private posMessageFor(error: HttpErrorResponse): string {
    const code = (error.error as { code?: string } | null)?.code;
    if (code === 'INSUFFICIENT_STOCK') return 'No hay existencia suficiente para esa cantidad.';
    if (code === 'PRODUCT_NOT_AVAILABLE') return 'Uno de los productos ya no está disponible.';
    if (code === 'PRODUCT_NOT_FOUND') return 'Uno de los productos ya no existe.';
    if (code === 'INSUFFICIENT_CASH_RECEIVED') {
      return 'El efectivo recibido no cubre el total de la venta.';
    }
    if (code === 'IDEMPOTENCY_KEY_REUSED') {
      return 'La venta cambió durante el reintento. Revisa el carrito e intenta nuevamente.';
    }
    if (error.status === 0) return 'No pudimos conectar con el servicio. Intenta nuevamente.';
    return 'No fue posible completar la venta.';
  }

  private resetCompletedSale(): void {
    this.completedSale.set(null);
    this.pendingSale = null;
  }
}
