import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import {
  ProductApiService,
  ProductData,
  ProductInput,
  ProductStatusFilter,
} from '../catalog/product-api.service';
import {
  InventoryApiService,
  InventoryBalanceData,
  InventoryMovementInput,
  InventoryMovementHistoryItem,
  InventoryMovementType,
  InventoryStateTransitionInput,
  InventoryStockState,
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
import { AuditApiService, AuditEventData } from '../audit/audit-api.service';
import {
  OrganizationApiService,
  OrganizationBranchData,
  OrganizationWarehouseData,
} from '../organization/organization-api.service';
import {
  InventoryTransferApiService,
  InventoryTransferData,
  InventoryTransferInput,
  InventoryTransferLineData,
  InventoryTransferReceiptInput,
  InventoryTransferStatus,
} from '../inventory/inventory-transfer-api.service';

const MONEY_PATTERN = /^(0|[1-9]\d{0,11})(\.\d{1,2})?$/;
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
const BARCODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{3,63}$/;
const QUANTITY_PATTERN = /^-?(0|[1-9]\d{0,11})(\.\d{1,3})?$/;
const POSITIVE_QUANTITY_PATTERN = /^(0|[1-9]\d{0,11})(\.\d{1,3})?$/;
const CART_QUANTITY_PATTERN = /^(0|[1-9]\d{0,8})(\.\d{1,3})?$/;
const LOCATION_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/;

interface CartEntry {
  product: ProductData;
  quantity: string;
}

@Component({
  selector: 'app-application-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './application.page.html',
  styleUrl: './application.page.scss',
})
export class ApplicationPage implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly products = inject(ProductApiService);
  private readonly inventory = inject(InventoryApiService);
  private readonly sessions = inject(SessionApiService);
  private readonly pos = inject(PosApiService);
  private readonly audit = inject(AuditApiService);
  private readonly organization = inject(OrganizationApiService);
  private readonly transfers = inject(InventoryTransferApiService);
  private pendingMovement: { input: InventoryMovementInput; key: string } | null = null;
  private pendingStateTransition: {
    input: InventoryStateTransitionInput;
    key: string;
  } | null = null;
  private pendingTransfer: { input: InventoryTransferInput; key: string } | null = null;
  private pendingTransferDispatch: { id: string; key: string } | null = null;
  private pendingTransferReceipt: {
    transferId: string;
    lineId: string;
    input: InventoryTransferReceiptInput;
    key: string;
  } | null = null;
  private pendingSale: {
    input: { lines: Array<{ productId: string; quantity: string }>; cashReceived: string };
    key: string;
  } | null = null;

  protected readonly session = this.sessions.session;
  protected readonly canManageTenant = computed(
    () => this.session()?.user.permissions.includes('TENANT_MANAGE') ?? false,
  );
  protected readonly canManageProducts = computed(
    () => this.session()?.user.permissions.includes('PRODUCTS_MANAGE') ?? false,
  );
  protected readonly canManageStock = computed(
    () => this.session()?.user.permissions.includes('STOCK_MANAGE') ?? false,
  );
  protected readonly canManageSales = computed(
    () =>
      Boolean(this.session()?.context.cashRegister) &&
      (this.session()?.user.permissions.includes('SALES_MANAGE') ?? false),
  );
  protected readonly canViewAudit = computed(
    () => this.session()?.user.roles.includes('ADMIN') ?? false,
  );
  protected readonly hasNoCoreAccess = computed(
    () =>
      !this.canManageTenant() &&
      !this.canManageProducts() &&
      !this.canManageStock() &&
      !this.canManageSales() &&
      !this.canViewAudit(),
  );
  protected readonly categories = signal<Array<{ id: string; name: string }>>([]);
  protected readonly brands = signal<Array<{ id: string; name: string }>>([]);
  protected readonly createdProduct = signal<ProductData | null>(null);
  protected readonly editingProduct = signal<ProductData | null>(null);
  protected readonly updatedProduct = signal(false);
  protected readonly retiringProduct = signal(false);
  protected readonly confirmingRetirement = signal(false);
  protected readonly retirementMessage = signal<string | null>(null);
  protected readonly productList = signal<ProductData[]>([]);
  protected readonly selectedProduct = signal<ProductData | null>(null);
  protected readonly locations = signal<Array<{ id: string; name: string; code: string }>>([]);
  protected readonly stockBalance = signal<InventoryBalanceData | null>(null);
  protected readonly loadingOptions = signal(true);
  protected readonly loadingCatalog = signal(true);
  protected readonly loadingDetail = signal(false);
  protected readonly saving = signal(false);
  protected readonly savingStock = signal(false);
  protected readonly savingStateTransition = signal(false);
  protected readonly savingOrganization = signal(false);
  protected readonly savingTransfer = signal(false);
  protected readonly transferActionId = signal<string | null>(null);
  protected readonly switchingContext = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly catalogError = signal<string | null>(null);
  protected readonly stockError = signal<string | null>(null);
  protected readonly stockSuccess = signal<string | null>(null);
  protected readonly stateTransitionError = signal<string | null>(null);
  protected readonly stateTransitionSuccess = signal<string | null>(null);
  protected readonly organizations = signal<OrganizationBranchData[]>([]);
  protected readonly loadingOrganization = signal(true);
  protected readonly organizationError = signal<string | null>(null);
  protected readonly organizationSuccess = signal<string | null>(null);
  protected readonly transferList = signal<InventoryTransferData[]>([]);
  protected readonly loadingTransfers = signal(true);
  protected readonly transferError = signal<string | null>(null);
  protected readonly transferSuccess = signal<string | null>(null);
  protected readonly editingBranch = signal<OrganizationBranchData | null>(null);
  protected readonly editingWarehouse = signal<
    (OrganizationWarehouseData & { branchId: string }) | null
  >(null);
  protected readonly organizationRetirement = signal<{
    type: 'BRANCH' | 'WAREHOUSE';
    id: string;
  } | null>(null);
  protected readonly stockList = signal<InventoryStockItem[]>([]);
  protected readonly stockListError = signal<string | null>(null);
  protected readonly loadingStockList = signal(true);
  protected readonly movementHistory = signal<InventoryMovementHistoryItem[]>([]);
  protected readonly loadingMovementHistory = signal(true);
  protected readonly movementHistoryError = signal<string | null>(null);
  protected readonly movementPage = signal(1);
  protected readonly movementTotalPages = signal(0);
  protected readonly movementTotal = signal(0);
  protected readonly movementBranch = signal<string | null>(null);
  protected readonly stockPage = signal(1);
  protected readonly stockTotalPages = signal(0);
  protected readonly stockTotal = signal(0);
  protected readonly negativeStockPolicy = signal<'DENY'>('DENY');
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
  protected readonly auditEvents = signal<AuditEventData[]>([]);
  protected readonly loadingAudit = signal(true);
  protected readonly auditError = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(0);
  protected readonly totalProducts = signal(0);
  protected readonly pageSize = 5;
  protected readonly pendingOperation = computed(() => {
    if (this.saving()) return this.editingProduct() ? 'Guardando producto…' : 'Creando producto…';
    if (this.retiringProduct()) return 'Retirando producto del catálogo…';
    if (this.savingStock()) return 'Registrando movimiento de inventario…';
    if (this.savingStateTransition()) return 'Actualizando estado del inventario…';
    if (this.savingOrganization()) return 'Guardando estructura operativa…';
    if (this.savingTransfer()) return 'Creando transferencia…';
    if (this.transferActionId()) return 'Actualizando transferencia…';
    if (this.switchingContext()) return 'Cambiando contexto operativo…';
    if (this.savingSale()) return 'Confirmando venta y actualizando inventario…';
    if (this.quotingCart()) return 'Validando precios y existencias…';
    return null;
  });
  protected readonly searchForm = this.formBuilder.nonNullable.group({
    q: ['', [Validators.maxLength(80)]],
    status: ['ACTIVE' as ProductStatusFilter],
  });
  protected readonly stockSearchForm = this.formBuilder.nonNullable.group({
    q: ['', [Validators.maxLength(80)]],
  });
  protected readonly movementFilterForm = this.formBuilder.nonNullable.group({
    q: ['', [Validators.maxLength(80)]],
    location: ['', [Validators.maxLength(120)]],
    responsible: ['', [Validators.maxLength(254)]],
    document: ['', [Validators.maxLength(128)]],
    type: ['' as '' | InventoryMovementType],
    dateFrom: [''],
    dateTo: [''],
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
  protected readonly stateTransitionForm = this.formBuilder.nonNullable.group({
    fromState: ['AVAILABLE' as InventoryStockState, [Validators.required]],
    toState: ['RESERVED' as InventoryStockState, [Validators.required]],
    quantity: ['', [Validators.required, Validators.pattern(POSITIVE_QUANTITY_PATTERN)]],
    reason: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
    reference: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
  });
  protected readonly contextForm = this.formBuilder.nonNullable.group({
    branchId: ['', [Validators.required]],
    warehouseId: ['', [Validators.required]],
  });
  protected readonly transferForm = this.formBuilder.nonNullable.group({
    destinationWarehouseId: ['', [Validators.required]],
    sourceLocationId: ['', [Validators.required]],
    destinationLocationId: ['', [Validators.required]],
    quantity: ['', [Validators.required, Validators.pattern(POSITIVE_QUANTITY_PATTERN)]],
    reference: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    reason: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
  });
  protected readonly branchForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    timezone: ['America/Mexico_City', [Validators.required, Validators.maxLength(64)]],
    warehouseName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    locationName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    locationCode: ['', [Validators.required, Validators.pattern(LOCATION_CODE_PATTERN)]],
  });
  protected readonly warehouseForm = this.formBuilder.nonNullable.group({
    branchId: ['', [Validators.required]],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    locationName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    locationCode: ['', [Validators.required, Validators.pattern(LOCATION_CODE_PATTERN)]],
  });

  ngOnInit(): void {
    this.loadOrganization();
    if (this.canManageProducts()) {
      this.loadOptions();
      this.loadProducts(1);
    }
    if (this.canManageStock()) {
      this.loadLocations();
      this.loadStockList(1);
      this.loadMovementHistory(1);
      this.loadTransfers();
    }
    if (this.canManageSales()) this.loadSales(1);
    if (this.canViewAudit()) this.loadAuditEvents();
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
        this.loadAuditEvents();
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

  protected requestRetirement(): void {
    this.confirmingRetirement.set(true);
    this.retirementMessage.set(null);
    this.catalogError.set(null);
  }

  protected cancelRetirement(): void {
    this.confirmingRetirement.set(false);
  }

  protected retireProduct(product: ProductData): void {
    if (this.retiringProduct()) return;
    this.retiringProduct.set(true);
    this.catalogError.set(null);
    this.products
      .retire(product.id)
      .pipe(finalize(() => this.retiringProduct.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.confirmingRetirement.set(false);
          this.editingProduct.set(null);
          this.createdProduct.set(null);
          this.updatedProduct.set(false);
          if (data.outcome === 'DELETED') {
            this.selectedProduct.set(null);
            this.stockBalance.set(null);
            this.retirementMessage.set('Producto eliminado porque no tenía stock ni historial.');
          } else {
            this.selectedProduct.set(data.product);
            this.retirementMessage.set(
              'Producto desactivado; su stock e historial se conservaron.',
            );
          }
          this.loadProducts(1);
          if (this.canManageStock()) this.loadStockList(1);
          if (this.canViewAudit()) this.loadAuditEvents();
        },
        error: (error: HttpErrorResponse) =>
          this.catalogError.set(
            this.operationMessage(error, 'No fue posible retirar el producto.'),
          ),
      });
  }

  protected logout(): void {
    this.sessions.logout().subscribe({ error: () => undefined });
  }

  protected activeBranches(): OrganizationBranchData[] {
    return this.organizations().filter(({ active }) => active);
  }

  protected contextWarehouses(): OrganizationWarehouseData[] {
    return (
      this.organizations().find(({ id }) => id === this.contextForm.controls.branchId.value)
        ?.warehouses ?? []
    ).filter(({ active }) => active);
  }

  protected contextBranchChanged(): void {
    const currentWarehouse = this.contextForm.controls.warehouseId.value;
    const warehouses = this.contextWarehouses();
    if (!warehouses.some(({ id }) => id === currentWarehouse)) {
      this.contextForm.controls.warehouseId.setValue(warehouses[0]?.id ?? '');
    }
  }

  protected transferDestinations(): Array<{
    branch: OrganizationBranchData;
    warehouse: OrganizationWarehouseData;
  }> {
    const currentWarehouseId = this.session()?.context.warehouse?.id;
    return this.activeBranches().flatMap((branch) =>
      branch.warehouses
        .filter(({ active, id }) => active && id !== currentWarehouseId)
        .map((warehouse) => ({ branch, warehouse })),
    );
  }

  protected transferDestinationLocations() {
    const warehouseId = this.transferForm.controls.destinationWarehouseId.value;
    return (
      this.transferDestinations().find(({ warehouse }) => warehouse.id === warehouseId)?.warehouse
        .locations ?? []
    ).filter(({ active }) => active);
  }

  protected transferDestinationChanged(): void {
    const locations = this.transferDestinationLocations();
    const current = this.transferForm.controls.destinationLocationId.value;
    if (!locations.some(({ id }) => id === current)) {
      this.transferForm.controls.destinationLocationId.setValue(locations[0]?.id ?? '');
    }
  }

  protected changeContext(): void {
    if (this.contextForm.invalid || this.switchingContext()) {
      this.contextForm.markAllAsTouched();
      return;
    }
    const { branchId, warehouseId } = this.contextForm.getRawValue();
    if (
      branchId === this.session()?.context.branch?.id &&
      warehouseId === this.session()?.context.warehouse?.id
    ) {
      return;
    }
    this.switchingContext.set(true);
    this.organizationError.set(null);
    this.organizationSuccess.set(null);
    this.sessions
      .changeContext(branchId, warehouseId)
      .pipe(finalize(() => this.switchingContext.set(false)))
      .subscribe({
        next: () => {
          this.organizationSuccess.set('Contexto operativo actualizado.');
          this.stockForm.controls.locationId.setValue('');
          this.transferForm.controls.sourceLocationId.setValue('');
          this.locations.set([]);
          this.stockBalance.set(null);
          this.cart.set([]);
          this.cartQuote.set(null);
          this.completedSale.set(null);
          this.selectedSale.set(null);
          this.salesHistory.set([]);
          if (this.canManageStock()) {
            this.loadLocations();
            this.loadStockList(1);
            this.loadMovementHistory(1);
            this.loadTransfers();
            this.syncTransferTargets();
          }
          if (this.canManageSales()) this.loadSales(1);
        },
        error: (error: HttpErrorResponse) =>
          this.organizationError.set(
            this.operationMessage(error, 'No fue posible cambiar el contexto operativo.'),
          ),
      });
  }

  protected submitBranch(): void {
    if (this.branchForm.invalid || this.savingOrganization()) {
      this.branchForm.markAllAsTouched();
      return;
    }
    const value = this.branchForm.getRawValue();
    const editing = this.editingBranch();
    const operation = editing
      ? this.organization.updateBranch(editing.id, {
          name: value.name.trim(),
          timezone: value.timezone.trim(),
        })
      : this.organization.createBranch({
          name: value.name.trim(),
          timezone: value.timezone.trim(),
          warehouseName: value.warehouseName.trim(),
          locationName: value.locationName.trim(),
          locationCode: value.locationCode.trim(),
        });
    this.savingOrganization.set(true);
    this.organizationError.set(null);
    this.organizationSuccess.set(null);
    operation.pipe(finalize(() => this.savingOrganization.set(false))).subscribe({
      next: () => {
        this.organizationSuccess.set(
          editing ? 'Sucursal actualizada.' : 'Sucursal y bodega creadas.',
        );
        this.cancelBranchEditing();
        this.loadOrganization();
        this.loadAuditEvents();
      },
      error: (error: HttpErrorResponse) =>
        this.organizationError.set(this.organizationMessageFor(error)),
    });
  }

  protected editBranch(branch: OrganizationBranchData): void {
    this.editingBranch.set(branch);
    const warehouse = branch.warehouses[0];
    const location = warehouse?.locations[0];
    this.branchForm.reset({
      name: branch.name,
      timezone: branch.timezone,
      warehouseName: warehouse?.name ?? 'Bodega',
      locationName: location?.name ?? 'General',
      locationCode: location?.code ?? 'GENERAL',
    });
  }

  protected cancelBranchEditing(): void {
    this.editingBranch.set(null);
    this.branchForm.reset({
      name: '',
      timezone: 'America/Mexico_City',
      warehouseName: '',
      locationName: '',
      locationCode: '',
    });
  }

  protected submitWarehouse(): void {
    if (this.warehouseForm.invalid || this.savingOrganization()) {
      this.warehouseForm.markAllAsTouched();
      return;
    }
    const value = this.warehouseForm.getRawValue();
    const editing = this.editingWarehouse();
    const operation = editing
      ? this.organization.updateWarehouse(editing.id, { name: value.name.trim() })
      : this.organization.createWarehouse(value.branchId, {
          name: value.name.trim(),
          locationName: value.locationName.trim(),
          locationCode: value.locationCode.trim(),
        });
    this.savingOrganization.set(true);
    this.organizationError.set(null);
    this.organizationSuccess.set(null);
    operation.pipe(finalize(() => this.savingOrganization.set(false))).subscribe({
      next: () => {
        this.organizationSuccess.set(editing ? 'Bodega actualizada.' : 'Bodega creada.');
        this.cancelWarehouseEditing();
        this.loadOrganization();
        this.loadAuditEvents();
      },
      error: (error: HttpErrorResponse) =>
        this.organizationError.set(this.organizationMessageFor(error)),
    });
  }

  protected editWarehouse(branchId: string, warehouse: OrganizationWarehouseData): void {
    this.editingWarehouse.set({ ...warehouse, branchId });
    const location = warehouse.locations[0];
    this.warehouseForm.reset({
      branchId,
      name: warehouse.name,
      locationName: location?.name ?? 'General',
      locationCode: location?.code ?? 'GENERAL',
    });
  }

  protected cancelWarehouseEditing(): void {
    this.editingWarehouse.set(null);
    this.warehouseForm.reset({
      branchId: this.activeBranches()[0]?.id ?? '',
      name: '',
      locationName: '',
      locationCode: '',
    });
  }

  protected requestOrganizationRetirement(type: 'BRANCH' | 'WAREHOUSE', id: string): void {
    this.organizationRetirement.set({ type, id });
    this.organizationError.set(null);
  }

  protected cancelOrganizationRetirement(): void {
    this.organizationRetirement.set(null);
  }

  protected confirmOrganizationRetirement(): void {
    const candidate = this.organizationRetirement();
    if (!candidate || this.savingOrganization()) return;
    this.savingOrganization.set(true);
    this.organizationError.set(null);
    const operation =
      candidate.type === 'BRANCH'
        ? this.organization.retireBranch(candidate.id)
        : this.organization.retireWarehouse(candidate.id);
    operation.pipe(finalize(() => this.savingOrganization.set(false))).subscribe({
      next: () => {
        this.organizationRetirement.set(null);
        this.organizationSuccess.set('Estructura desactivada sin eliminar historial.');
        this.loadOrganization();
        this.loadAuditEvents();
      },
      error: (error: HttpErrorResponse) =>
        this.organizationError.set(this.organizationMessageFor(error)),
    });
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

  protected filterMovements(): void {
    const { dateFrom, dateTo } = this.movementFilterForm.getRawValue();
    if (dateFrom && dateTo && dateFrom > dateTo) {
      this.movementHistoryError.set('La fecha inicial no puede ser posterior a la fecha final.');
      return;
    }
    this.loadMovementHistory(1);
  }

  protected previousMovementPage(): void {
    if (this.movementPage() > 1) this.loadMovementHistory(this.movementPage() - 1);
  }

  protected nextMovementPage(): void {
    if (this.movementPage() < this.movementTotalPages()) {
      this.loadMovementHistory(this.movementPage() + 1);
    }
  }

  protected movementTypeLabel(type: InventoryMovementType): string {
    return {
      INITIAL: 'Stock inicial',
      ENTRY: 'Entrada',
      EXIT: 'Salida',
      RETURN: 'Devolución',
      LOSS: 'Pérdida',
      DAMAGE: 'Daño',
      ADJUSTMENT: 'Ajuste',
      STATE_TRANSITION: 'Cambio de estado',
      SALE: 'Venta',
      TRANSFER_OUT: 'Transferencia despachada',
      TRANSFER_IN: 'Transferencia en tránsito',
      TRANSFER_RECEIPT: 'Transferencia recibida',
      TRANSFER_DISCREPANCY: 'Diferencia de transferencia',
    }[type];
  }

  protected movementDocumentLabel(type: InventoryMovementHistoryItem['document']['type']): string {
    return {
      MOVEMENT: 'Movimiento',
      SALE: 'Venta',
      TRANSFER: 'Transferencia',
      RECEIPT: 'Recepción',
    }[type];
  }

  protected transferStatusLabel(status: InventoryTransferStatus): string {
    return {
      DRAFT: 'Borrador',
      DISPATCHED: 'Despachada',
      PARTIALLY_RECEIVED: 'Recibida parcialmente',
      RECEIVED: 'Recibida',
      CANCELLED: 'Cancelada',
    }[status];
  }

  protected stockStateLabel(state: InventoryStockState): string {
    return {
      AVAILABLE: 'Disponible',
      RESERVED: 'Reservado',
      DAMAGED: 'Dañado',
      IN_TRANSIT: 'En tránsito',
    }[state];
  }

  protected transitionTargets(): InventoryStockState[] {
    return this.stateTransitionForm.controls.fromState.value === 'AVAILABLE'
      ? ['RESERVED', 'DAMAGED', 'IN_TRANSIT']
      : ['AVAILABLE'];
  }

  protected transitionSourceChanged(): void {
    const targets = this.transitionTargets();
    if (!targets.includes(this.stateTransitionForm.controls.toState.value)) {
      this.stateTransitionForm.controls.toState.setValue(targets[0]);
    }
  }

  protected movementRequiresReference(): boolean {
    return this.stockForm.controls.type.value !== 'INITIAL';
  }

  protected movementTypeChanged(): void {
    const reference = this.stockForm.controls.reference;
    reference.setValidators(
      this.movementRequiresReference()
        ? [Validators.required, Validators.maxLength(120)]
        : [Validators.maxLength(120)],
    );
    reference.updateValueAndValidity();
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
        error: (error: HttpErrorResponse) =>
          this.posError.set(
            this.operationMessage(error, 'No fue posible buscar productos para la venta.'),
          ),
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
          this.loadMovementHistory(1);
          this.loadSales(1);
          this.loadAuditEvents();
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
          this.confirmingRetirement.set(false);
          this.retirementMessage.set(null);
          this.createdProduct.set(null);
          this.updatedProduct.set(false);
          this.editingProduct.set(null);
          this.selectedProduct.set(data);
          this.loadBalance(data.id);
        },
        error: (error: HttpErrorResponse) =>
          this.catalogError.set(
            this.operationMessage(error, 'No fue posible consultar el producto.'),
          ),
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
        error: (error: HttpErrorResponse) => {
          this.selectedSale.set(null);
          this.salesError.set(
            this.operationMessage(error, 'No fue posible consultar el detalle de la venta.'),
          );
        },
      });
  }

  protected dateTime(value: string): string {
    return new Date(value).toLocaleString('es-MX');
  }

  protected auditActionLabel(action: string): string {
    return (
      {
        REGISTRATION_CREATED: 'Cuenta creada',
        AUTH_LOGIN_SUCCEEDED: 'Inicio de sesión',
        COMPANY_UPDATED: 'Empresa actualizada',
        PRODUCT_CREATED: 'Producto creado',
        PRODUCT_UPDATED: 'Producto actualizado',
        INVENTORY_MOVEMENT_CREATED: 'Movimiento registrado',
        INVENTORY_STATE_TRANSITION_CREATED: 'Estado de inventario actualizado',
        INVENTORY_TRANSFER_CREATED: 'Transferencia creada',
        INVENTORY_TRANSFER_DISPATCHED: 'Transferencia despachada',
        INVENTORY_TRANSFER_RECEIVED: 'Transferencia recibida',
        INVENTORY_TRANSFER_CANCELLED: 'Transferencia cancelada',
        SESSION_CONTEXT_CHANGED: 'Contexto operativo actualizado',
        BRANCH_CREATED: 'Sucursal creada',
        BRANCH_UPDATED: 'Sucursal actualizada',
        BRANCH_RETIRED: 'Sucursal desactivada',
        WAREHOUSE_CREATED: 'Bodega creada',
        WAREHOUSE_UPDATED: 'Bodega actualizada',
        WAREHOUSE_RETIRED: 'Bodega desactivada',
        SALE_COMPLETED: 'Venta completada',
      }[action] ?? action
    );
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
      this.stockError.set(
        'Usa una cantidad positiva; el tipo de movimiento determina si entra o sale stock.',
      );
      return;
    }
    if (value.type !== 'INITIAL' && !value.reference.trim()) {
      this.stockForm.controls.reference.setErrors({ required: true });
      this.stockForm.controls.reference.markAsTouched();
      this.stockError.set('Agrega una referencia o evidencia para este movimiento.');
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
          this.movementTypeChanged();
          this.loadStockList(this.stockPage());
          this.loadMovementHistory(1);
          this.loadAuditEvents();
        },
        error: (error: HttpErrorResponse) => {
          if (error.status > 0 && error.status < 500) this.pendingMovement = null;
          this.stockError.set(this.stockMessageFor(error));
        },
      });
  }

  protected changeStockState(): void {
    const product = this.selectedProduct();
    const locationId = this.stockForm.controls.locationId.value;
    if (
      !product ||
      !locationId ||
      this.stateTransitionForm.invalid ||
      this.savingStateTransition()
    ) {
      this.stateTransitionForm.markAllAsTouched();
      return;
    }
    const value = this.stateTransitionForm.getRawValue();
    if (
      Number(value.quantity) <= 0 ||
      !this.transitionTargets().includes(value.toState) ||
      value.fromState === value.toState
    ) {
      this.stateTransitionError.set(
        'Selecciona una transición válida y una cantidad mayor que cero.',
      );
      return;
    }
    const input: InventoryStateTransitionInput = {
      productId: product.id,
      locationId,
      fromState: value.fromState,
      toState: value.toState,
      quantity: value.quantity.trim(),
      reason: value.reason.trim(),
      reference: value.reference.trim(),
    };
    const pending = this.pendingStateTransition;
    const idempotencyKey =
      pending && JSON.stringify(pending.input) === JSON.stringify(input)
        ? pending.key
        : `web-state-${globalThis.crypto.randomUUID()}`;
    this.pendingStateTransition = { input, key: idempotencyKey };
    this.savingStateTransition.set(true);
    this.stateTransitionError.set(null);
    this.stateTransitionSuccess.set(null);
    this.inventory
      .createStateTransition(input, idempotencyKey)
      .pipe(finalize(() => this.savingStateTransition.set(false)))
      .subscribe({
        next: () => {
          this.pendingStateTransition = null;
          this.stateTransitionSuccess.set(
            `${this.stockStateLabel(value.fromState)} → ${this.stockStateLabel(value.toState)}: ${value.quantity}.`,
          );
          this.stateTransitionForm.reset({
            fromState: 'AVAILABLE',
            toState: 'RESERVED',
            quantity: '',
            reason: '',
            reference: '',
          });
          this.loadBalance(product.id);
          this.loadStockList(this.stockPage());
          this.loadMovementHistory(1);
          this.loadAuditEvents();
        },
        error: (error: HttpErrorResponse) => {
          if (error.status > 0 && error.status < 500) this.pendingStateTransition = null;
          this.stateTransitionError.set(this.stateTransitionMessageFor(error));
        },
      });
  }

  protected createTransfer(): void {
    const product = this.selectedProduct();
    const value = this.transferForm.getRawValue();
    if (
      !product ||
      !product.active ||
      this.transferForm.invalid ||
      Number(value.quantity) <= 0 ||
      this.savingTransfer()
    ) {
      this.transferForm.markAllAsTouched();
      if (!product) this.transferError.set('Selecciona un producto del catálogo.');
      return;
    }
    const input: InventoryTransferInput = {
      destinationWarehouseId: value.destinationWarehouseId,
      reference: value.reference.trim(),
      reason: value.reason.trim(),
      lines: [
        {
          productId: product.id,
          sourceLocationId: value.sourceLocationId,
          destinationLocationId: value.destinationLocationId,
          quantity: value.quantity.trim(),
        },
      ],
    };
    const pending = this.pendingTransfer;
    const key =
      pending && JSON.stringify(pending.input) === JSON.stringify(input)
        ? pending.key
        : `web-transfer-${globalThis.crypto.randomUUID()}`;
    this.pendingTransfer = { input, key };
    this.savingTransfer.set(true);
    this.transferError.set(null);
    this.transferSuccess.set(null);
    this.transfers
      .create(input, key)
      .pipe(finalize(() => this.savingTransfer.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.pendingTransfer = null;
          this.transferSuccess.set(`Transferencia ${data.reference} creada como borrador.`);
          this.transferForm.controls.quantity.setValue('');
          this.transferForm.controls.reference.setValue('');
          this.transferForm.controls.reason.setValue('');
          this.loadTransfers();
          this.loadAuditEvents();
        },
        error: (error: HttpErrorResponse) => {
          if (error.status > 0 && error.status < 500) this.pendingTransfer = null;
          this.transferError.set(this.transferMessageFor(error));
        },
      });
  }

  protected dispatchTransfer(transfer: InventoryTransferData): void {
    if (this.transferActionId()) return;
    const pending = this.pendingTransferDispatch;
    const key =
      pending?.id === transfer.id
        ? pending.key
        : `web-transfer-dispatch-${globalThis.crypto.randomUUID()}`;
    this.pendingTransferDispatch = { id: transfer.id, key };
    this.transferActionId.set(transfer.id);
    this.transferError.set(null);
    this.transferSuccess.set(null);
    this.transfers
      .dispatch(transfer.id, key)
      .pipe(finalize(() => this.transferActionId.set(null)))
      .subscribe({
        next: ({ data }) => {
          this.pendingTransferDispatch = null;
          this.transferSuccess.set(`Transferencia ${data.reference} despachada.`);
          this.refreshInventoryAfterTransfer();
        },
        error: (error: HttpErrorResponse) => {
          if (error.status > 0 && error.status < 500) this.pendingTransferDispatch = null;
          this.transferError.set(this.transferMessageFor(error));
        },
      });
  }

  protected cancelTransfer(transfer: InventoryTransferData): void {
    if (this.transferActionId()) return;
    this.transferActionId.set(transfer.id);
    this.transferError.set(null);
    this.transferSuccess.set(null);
    this.transfers
      .cancel(transfer.id)
      .pipe(finalize(() => this.transferActionId.set(null)))
      .subscribe({
        next: ({ data }) => {
          this.transferSuccess.set(`Transferencia ${data.reference} cancelada.`);
          this.loadTransfers();
          this.loadAuditEvents();
        },
        error: (error: HttpErrorResponse) => this.transferError.set(this.transferMessageFor(error)),
      });
  }

  protected canReceiveTransfer(transfer: InventoryTransferData): boolean {
    return (
      ['DISPATCHED', 'PARTIALLY_RECEIVED'].includes(transfer.status) &&
      transfer.destinationWarehouse.id === this.session()?.context.warehouse?.id
    );
  }

  protected receiveTransferLine(
    transfer: InventoryTransferData,
    line: InventoryTransferLineData,
    receivedValue: string,
    discrepancyValue: string,
    reasonValue: string,
  ): void {
    if (this.transferActionId()) return;
    const received = receivedValue.trim();
    const discrepancy = discrepancyValue.trim();
    const reason = reasonValue.trim();
    if (
      !POSITIVE_QUANTITY_PATTERN.test(received) ||
      !POSITIVE_QUANTITY_PATTERN.test(discrepancy) ||
      Number(received) + Number(discrepancy) <= 0 ||
      Number(received) + Number(discrepancy) > Number(line.pendingQuantity)
    ) {
      this.transferError.set('La recepción debe ser positiva y no superar lo pendiente.');
      return;
    }
    if (Number(discrepancy) > 0 && reason.length < 2) {
      this.transferError.set('Describe el motivo de la diferencia de recepción.');
      return;
    }
    const input: InventoryTransferReceiptInput = {
      ...(Number(discrepancy) > 0 ? { discrepancyReason: reason } : {}),
      lines: [
        {
          transferLineId: line.id,
          receivedQuantity: received,
          discrepancyQuantity: discrepancy,
        },
      ],
    };
    const pending = this.pendingTransferReceipt;
    const key =
      pending?.transferId === transfer.id &&
      pending.lineId === line.id &&
      JSON.stringify(pending.input) === JSON.stringify(input)
        ? pending.key
        : `web-transfer-receipt-${globalThis.crypto.randomUUID()}`;
    this.pendingTransferReceipt = {
      transferId: transfer.id,
      lineId: line.id,
      input,
      key,
    };
    this.transferActionId.set(transfer.id);
    this.transferError.set(null);
    this.transferSuccess.set(null);
    this.transfers
      .receive(transfer.id, input, key)
      .pipe(finalize(() => this.transferActionId.set(null)))
      .subscribe({
        next: ({ data }) => {
          this.pendingTransferReceipt = null;
          this.transferSuccess.set(
            data.status === 'RECEIVED'
              ? `Transferencia ${data.reference} recibida por completo.`
              : `Recepción parcial registrada para ${data.reference}.`,
          );
          this.refreshInventoryAfterTransfer();
        },
        error: (error: HttpErrorResponse) => {
          if (error.status > 0 && error.status < 500) this.pendingTransferReceipt = null;
          this.transferError.set(this.transferMessageFor(error));
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
        error: (error: HttpErrorResponse) =>
          this.errorMessage.set(
            this.operationMessage(error, 'No fue posible cargar categorías y marcas.'),
          ),
      });
  }

  private loadOrganization(): void {
    this.loadingOrganization.set(true);
    this.organization
      .list()
      .pipe(finalize(() => this.loadingOrganization.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.organizations.set(data);
          const currentBranchId = this.session()?.context.branch?.id;
          const branch =
            data.find(({ id, active }) => active && id === currentBranchId) ??
            data.find(({ active }) => active);
          const currentWarehouseId = this.session()?.context.warehouse?.id;
          const warehouse =
            branch?.warehouses.find(({ id, active }) => active && id === currentWarehouseId) ??
            branch?.warehouses.find(({ active }) => active);
          this.contextForm.setValue({
            branchId: branch?.id ?? '',
            warehouseId: warehouse?.id ?? '',
          });
          if (!this.warehouseForm.controls.branchId.value) {
            this.warehouseForm.controls.branchId.setValue(branch?.id ?? '');
          }
          this.syncTransferTargets();
        },
        error: (error: HttpErrorResponse) =>
          this.organizationError.set(
            this.operationMessage(error, 'No fue posible cargar sucursales y bodegas.'),
          ),
      });
  }

  private loadLocations(): void {
    this.inventory.listLocations().subscribe({
      next: ({ data }) => {
        this.locations.set(data);
        if (!this.stockForm.controls.locationId.value && data[0]) {
          this.stockForm.controls.locationId.setValue(data[0].id);
        }
        if (!this.transferForm.controls.sourceLocationId.value && data[0]) {
          this.transferForm.controls.sourceLocationId.setValue(data[0].id);
        }
        const product = this.selectedProduct();
        if (product) this.loadBalance(product.id);
      },
      error: (error: HttpErrorResponse) =>
        this.stockError.set(this.operationMessage(error, 'No fue posible cargar las ubicaciones.')),
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
      error: (error: HttpErrorResponse) =>
        this.stockError.set(
          this.operationMessage(error, 'No fue posible consultar la existencia.'),
        ),
    });
  }

  private loadProducts(page: number): void {
    this.loadingCatalog.set(true);
    this.catalogError.set(null);
    const q = this.searchForm.controls.q.value.trim();
    const status = this.searchForm.controls.status.value;
    this.products
      .list({
        ...(q ? { q } : {}),
        ...(status === 'ACTIVE' ? {} : { status }),
        page,
        pageSize: this.pageSize,
      })
      .pipe(finalize(() => this.loadingCatalog.set(false)))
      .subscribe({
        next: ({ data, meta }) => {
          this.productList.set(data);
          this.page.set(meta.pagination.page);
          this.totalPages.set(meta.pagination.totalPages);
          this.totalProducts.set(meta.pagination.total);
        },
        error: (error: HttpErrorResponse) =>
          this.catalogError.set(this.operationMessage(error, 'No fue posible cargar el catálogo.')),
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
          this.negativeStockPolicy.set(meta.policy.negativeStock);
          this.stockScope.set(meta.scope);
          this.stockPage.set(meta.pagination.page);
          this.stockTotalPages.set(meta.pagination.totalPages);
          this.stockTotal.set(meta.pagination.total);
        },
        error: (error: HttpErrorResponse) =>
          this.stockListError.set(
            this.operationMessage(error, 'No fue posible cargar las existencias.'),
          ),
      });
  }

  private loadMovementHistory(page: number): void {
    this.loadingMovementHistory.set(true);
    this.movementHistoryError.set(null);
    const value = this.movementFilterForm.getRawValue();
    this.inventory
      .listMovements({
        ...(value.q.trim() ? { q: value.q.trim() } : {}),
        ...(value.location.trim() ? { location: value.location.trim() } : {}),
        ...(value.responsible.trim() ? { responsible: value.responsible.trim() } : {}),
        ...(value.document.trim() ? { document: value.document.trim() } : {}),
        ...(value.type ? { type: value.type } : {}),
        ...(value.dateFrom ? { dateFrom: value.dateFrom } : {}),
        ...(value.dateTo ? { dateTo: value.dateTo } : {}),
        page,
        pageSize: 10,
      })
      .pipe(finalize(() => this.loadingMovementHistory.set(false)))
      .subscribe({
        next: ({ data, meta }) => {
          this.movementHistory.set(data);
          this.movementPage.set(meta.pagination.page);
          this.movementTotalPages.set(meta.pagination.totalPages);
          this.movementTotal.set(meta.pagination.total);
          this.movementBranch.set(meta.scope.branch.name);
        },
        error: (error: HttpErrorResponse) => {
          this.movementHistory.set([]);
          this.movementHistoryError.set(
            this.operationMessage(error, 'No fue posible cargar el historial de movimientos.'),
          );
        },
      });
  }

  private loadTransfers(): void {
    this.loadingTransfers.set(true);
    this.transferError.set(null);
    this.transfers
      .list()
      .pipe(finalize(() => this.loadingTransfers.set(false)))
      .subscribe({
        next: ({ data }) => this.transferList.set(data),
        error: (error: HttpErrorResponse) => {
          this.transferList.set([]);
          this.transferError.set(
            this.operationMessage(error, 'No fue posible cargar las transferencias.'),
          );
        },
      });
  }

  private syncTransferTargets(): void {
    const destinations = this.transferDestinations();
    const selected = this.transferForm.controls.destinationWarehouseId.value;
    if (!destinations.some(({ warehouse }) => warehouse.id === selected)) {
      this.transferForm.controls.destinationWarehouseId.setValue(
        destinations[0]?.warehouse.id ?? '',
      );
    }
    this.transferDestinationChanged();
  }

  private refreshInventoryAfterTransfer(): void {
    this.loadTransfers();
    this.loadStockList(this.stockPage());
    this.loadMovementHistory(1);
    this.loadAuditEvents();
    const selected = this.selectedProduct();
    if (selected) this.loadBalance(selected.id);
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
        error: (error: HttpErrorResponse) => {
          this.salesHistory.set([]);
          this.selectedSale.set(null);
          this.salesError.set(
            this.operationMessage(error, 'No fue posible cargar el historial de ventas.'),
          );
        },
      });
  }

  private loadAuditEvents(): void {
    this.loadingAudit.set(true);
    this.auditError.set(null);
    this.audit
      .list()
      .pipe(finalize(() => this.loadingAudit.set(false)))
      .subscribe({
        next: ({ data }) => this.auditEvents.set(data),
        error: (error: HttpErrorResponse) => {
          this.auditEvents.set([]);
          this.auditError.set(this.operationMessage(error, 'No fue posible cargar la auditoría.'));
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
    if (error.status === 403) return this.permissionMessage();
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
    if (code === 'MOVEMENT_REFERENCE_REQUIRED') {
      return 'Agrega una referencia o evidencia para este movimiento.';
    }
    if (error.status === 403) return this.permissionMessage();
    if (error.status === 0) return 'No pudimos conectar con el servicio. Intenta nuevamente.';
    return 'No fue posible registrar el movimiento.';
  }

  private stateTransitionMessageFor(error: HttpErrorResponse): string {
    const code = (error.error as { code?: string } | null)?.code;
    if (code === 'INVALID_STOCK_STATE_TRANSITION') {
      return 'Ese cambio no es válido; pasa primero por Disponible.';
    }
    if (code === 'INSUFFICIENT_STOCK_STATE') {
      return 'No hay cantidad suficiente en el estado de origen.';
    }
    if (code === 'IDEMPOTENCY_KEY_REUSED') {
      return 'El cambio fue modificado durante el reintento. Revísalo e intenta nuevamente.';
    }
    if (error.status === 403) return this.permissionMessage();
    if (error.status === 0) return 'No pudimos conectar con el servicio. Intenta nuevamente.';
    return 'No fue posible actualizar el estado del inventario.';
  }

  private organizationMessageFor(error: HttpErrorResponse): string {
    const code = (error.error as { code?: string } | null)?.code;
    if (code === 'ORGANIZATION_NAME_CONFLICT') {
      return 'Ya existe una sucursal o bodega con ese nombre.';
    }
    if (code === 'ORGANIZATION_IN_USE') {
      return 'No puede desactivarse porque tiene stock, historial, ventas o una sesión activa.';
    }
    if (code === 'INITIAL_ORGANIZATION_TARGET') {
      return 'La sucursal y bodega iniciales no pueden desactivarse.';
    }
    if (error.status === 403) return this.permissionMessage();
    if (error.status === 0) return 'No pudimos conectar con el servicio. Intenta nuevamente.';
    return 'No fue posible guardar la estructura operativa.';
  }

  private transferMessageFor(error: HttpErrorResponse): string {
    const code = (error.error as { code?: string } | null)?.code;
    if (code === 'INSUFFICIENT_AVAILABLE_STOCK') {
      return 'La ubicación de origen no tiene stock disponible suficiente.';
    }
    if (code === 'INVALID_TRANSFER_TARGET') {
      return 'Revisa la bodega, ubicaciones y producto de la transferencia.';
    }
    if (code === 'TRANSFER_STATUS_CONFLICT') {
      return 'La transferencia ya no permite esta operación. Actualiza la lista.';
    }
    if (code === 'TRANSFER_RECEIPT_EXCEEDS_PENDING') {
      return 'La cantidad supera lo pendiente de recibir. Actualiza la lista.';
    }
    if (code === 'TRANSFER_DISCREPANCY_REASON_REQUIRED') {
      return 'Describe el motivo de la diferencia de recepción.';
    }
    if (code === 'INVALID_TRANSFER_RECEIPT') {
      return 'Revisa las cantidades de la recepción.';
    }
    if (code === 'IDEMPOTENCY_KEY_REUSED') {
      return 'La transferencia cambió durante el reintento. Revísala e intenta nuevamente.';
    }
    if (error.status === 403) return this.permissionMessage();
    if (error.status === 0) return 'No pudimos conectar con el servicio. Intenta nuevamente.';
    return 'No fue posible procesar la transferencia.';
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
    if (error.status === 403) return this.permissionMessage();
    if (error.status === 0) return 'No pudimos conectar con el servicio. Intenta nuevamente.';
    return 'No fue posible completar la venta.';
  }

  private operationMessage(error: HttpErrorResponse, fallback: string): string {
    if (error.status === 403) return this.permissionMessage();
    if (error.status === 0) return 'No pudimos conectar con el servicio. Intenta nuevamente.';
    return fallback;
  }

  private permissionMessage(): string {
    return 'No tienes permisos suficientes para realizar esta operación.';
  }

  private resetCompletedSale(): void {
    this.completedSale.set(null);
    this.pendingSale = null;
  }
}
