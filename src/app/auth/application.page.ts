import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
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
import { InventoryImportPanelComponent } from '../inventory/inventory-import-panel.component';
import { InventoryCountPanelComponent } from '../inventory/inventory-count-panel.component';
import { SessionApiService } from './session-api.service';
import {
  CashRegisterClosureData,
  CashRegisterMovementData,
  CashRegisterShiftData,
  CashSaleData,
  PaymentMethod,
  PosApiService,
  PosCartQuote,
  SaleDetailData,
  SaleSummaryData,
  SalesCashReportData,
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
import {
  AccessApiService,
  AccessRoleData,
  AccessUserData,
  AppPermission,
  OPERATIONAL_PERMISSIONS,
} from '../access/access-api.service';
import { SupplierPanelComponent } from '../suppliers/supplier-panel.component';
import { PurchaseOrderPanelComponent } from '../procurement/purchase-order-panel.component';
import { CustomerApiService, CustomerData, CustomerInput } from '../customers/customer-api.service';
import { CustomerHistoryPanelComponent } from '../customers/customer-history-panel.component';
import { ProductReservationPanelComponent } from '../reservations/product-reservation-panel.component';
import { OfflineBootstrapPanelComponent } from '../offline/offline-bootstrap-panel.component';
import { OfflinePosService } from '../offline/offline-pos.service';
import { OfflineInventoryPanelComponent } from '../offline/offline-inventory-panel.component';
import { CatalogClassificationPanelComponent } from '../catalog/catalog-classification-panel.component';
import { ProductCodeScannerComponent } from '../catalog/product-code-scanner.component';

const MONEY_PATTERN = /^(0|[1-9]\d{0,11})(\.\d{1,2})?$/;
const POSITIVE_MONEY_PATTERN = /^(?:[1-9]\d{0,11}(?:\.\d{1,2})?|0\.(?:0[1-9]|[1-9]\d?))$/;
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
const BARCODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{3,63}$/;
const QUANTITY_PATTERN = /^-?(0|[1-9]\d{0,11})(\.\d{1,3})?$/;
const POSITIVE_QUANTITY_PATTERN = /^(0|[1-9]\d{0,11})(\.\d{1,3})?$/;
const CART_QUANTITY_PATTERN = /^(0|[1-9]\d{0,8})(\.\d{1,3})?$/;
const LOCATION_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/;
const PAYMENT_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{3,119}$/;

interface CartEntry {
  product: ProductData;
  quantity: string;
}

@Component({
  selector: 'app-application-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    InventoryImportPanelComponent,
    InventoryCountPanelComponent,
    CustomerHistoryPanelComponent,
    SupplierPanelComponent,
    PurchaseOrderPanelComponent,
    ProductReservationPanelComponent,
    OfflineBootstrapPanelComponent,
    OfflineInventoryPanelComponent,
    CatalogClassificationPanelComponent,
    ProductCodeScannerComponent,
  ],
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
  private readonly access = inject(AccessApiService);
  private readonly customersApi = inject(CustomerApiService);
  private readonly offlinePos = inject(OfflinePosService);
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
    input: {
      lines: Array<{ productId: string; quantity: string }>;
      customerId?: string;
      payments: Array<{
        method: PaymentMethod;
        amount: string;
        amountReceived?: string;
        reference?: string;
      }>;
    };
    key: string;
  } | null = null;
  private pendingSaleVoid: { saleId: string; reason: string; key: string } | null = null;
  private pendingShiftOpening: { openingAmount: string; key: string } | null = null;
  private pendingCashMovement: {
    input: { type: 'INCOME' | 'WITHDRAWAL'; amount: string; reason: string };
    key: string;
  } | null = null;
  private pendingCashReversal: { movementId: string; reason: string; key: string } | null = null;
  private pendingCashClosure: {
    input: {
      countedAmount: string;
      differenceReason?: string;
      denominations?: Array<{ denomination: string; quantity: number }>;
    };
    key: string;
  } | null = null;

  protected readonly session = this.sessions.session;
  protected readonly canManageTenant = computed(
    () => this.session()?.user.permissions.includes('TENANT_MANAGE') ?? false,
  );
  protected readonly canManageProducts = computed(
    () => this.session()?.user.permissions.includes('PRODUCTS_MANAGE') ?? false,
  );
  protected readonly canManageSuppliers = computed(
    () => this.session()?.user.permissions.includes('SUPPLIERS_MANAGE') ?? false,
  );
  protected readonly canManagePurchaseOrders = computed(
    () => this.session()?.user.permissions.includes('PURCHASE_ORDERS_MANAGE') ?? false,
  );
  protected readonly canApprovePurchaseOrders = computed(
    () => this.session()?.user.permissions.includes('PURCHASE_ORDERS_APPROVE') ?? false,
  );
  protected readonly canOverReceivePurchaseOrders = computed(
    () => this.session()?.user.permissions.includes('PURCHASE_RECEIPTS_OVERAGE') ?? false,
  );
  protected readonly canAccessPurchaseOrders = computed(
    () => this.canManagePurchaseOrders() || this.canApprovePurchaseOrders(),
  );
  protected readonly canManageStock = computed(
    () => this.session()?.user.permissions.includes('INVENTORY_VIEW') ?? false,
  );
  protected readonly canAdjustInventory = computed(
    () => this.session()?.user.permissions.includes('INVENTORY_ADJUST') ?? false,
  );
  protected readonly canCountInventory = computed(
    () => this.session()?.user.permissions.includes('INVENTORY_COUNT') ?? false,
  );
  protected readonly canTransferInventory = computed(
    () => this.session()?.user.permissions.includes('INVENTORY_TRANSFER') ?? false,
  );
  protected readonly canApproveInventory = computed(
    () => this.session()?.user.permissions.includes('INVENTORY_APPROVE') ?? false,
  );
  protected readonly canManageAccess = computed(
    () => this.session()?.user.permissions.includes('ACCESS_MANAGE') ?? false,
  );
  protected readonly canManageSales = computed(
    () =>
      Boolean(this.session()?.context.cashRegister) &&
      (this.session()?.user.permissions.includes('SALES_MANAGE') ?? false),
  );
  protected readonly canVoidSales = computed(
    () => this.session()?.user.permissions.includes('SALES_VOID') ?? false,
  );
  protected readonly canOpenCashRegister = computed(
    () => this.session()?.user.permissions.includes('CASH_REGISTER_OPEN') ?? false,
  );
  protected readonly canCloseCashRegister = computed(
    () => this.session()?.user.permissions.includes('CASH_REGISTER_CLOSE') ?? false,
  );
  protected readonly canMoveCash = computed(
    () => this.session()?.user.permissions.includes('CASH_REGISTER_MOVE') ?? false,
  );
  protected readonly canViewAudit = computed(
    () => this.session()?.user.permissions.includes('AUDIT_VIEW') ?? false,
  );
  protected readonly canExportAudit = computed(
    () => this.session()?.user.permissions.includes('AUDIT_EXPORT') ?? false,
  );
  protected readonly hasNoCoreAccess = computed(
    () =>
      !this.canManageTenant() &&
      !this.canManageProducts() &&
      !this.canManageSuppliers() &&
      !this.canAccessPurchaseOrders() &&
      !this.canManageStock() &&
      !this.canManageSales() &&
      !this.canManageAccess() &&
      !this.canViewAudit(),
  );
  protected readonly rolePermissions = OPERATIONAL_PERMISSIONS;
  protected readonly accessRoles = signal<AccessRoleData[]>([]);
  protected readonly accessUsers = signal<AccessUserData[]>([]);
  protected readonly manageableAccessUsers = computed(() =>
    this.accessUsers().filter(({ manageable }) => manageable),
  );
  protected readonly selectedRolePermissions = signal<AppPermission[]>(['INVENTORY_VIEW']);
  protected readonly loadingAccess = signal(false);
  protected readonly savingAccess = signal(false);
  protected readonly accessError = signal<string | null>(null);
  protected readonly accessSuccess = signal<string | null>(null);
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
  protected readonly currentCashRegisterShift = signal<CashRegisterShiftData | null>(null);
  protected readonly loadingCashRegisterShift = signal(true);
  protected readonly openingCashRegisterShift = signal(false);
  protected readonly cashRegisterShiftError = signal<string | null>(null);
  protected readonly cashRegisterShiftSuccess = signal<string | null>(null);
  protected readonly cashRegisterMovements = signal<CashRegisterMovementData[]>([]);
  protected readonly expectedCash = signal<string | null>(null);
  protected readonly loadingCashMovements = signal(false);
  protected readonly savingCashMovement = signal(false);
  protected readonly reversingCashMovementId = signal<string | null>(null);
  protected readonly cashMovementError = signal<string | null>(null);
  protected readonly cashMovementSuccess = signal<string | null>(null);
  protected readonly movementToReverse = signal<CashRegisterMovementData | null>(null);
  protected readonly latestCashClosure = signal<CashRegisterClosureData | null>(null);
  protected readonly loadingCashClosure = signal(false);
  protected readonly closingCashRegister = signal(false);
  protected readonly cashClosureError = signal<string | null>(null);
  protected readonly cashClosureSuccess = signal<string | null>(null);
  protected readonly cart = signal<CartEntry[]>([]);
  protected readonly cartQuote = signal<PosCartQuote | null>(null);
  protected readonly completedSale = signal<CashSaleData | null>(null);
  protected readonly searchingPos = signal(false);
  protected readonly quotingCart = signal(false);
  protected readonly savingSale = signal(false);
  protected readonly offlinePosActive = signal(false);
  protected readonly queuedOfflineSale = signal<{ commandId: string; total: string } | null>(null);
  protected readonly posError = signal<string | null>(null);
  protected readonly paymentMethods = signal<PaymentMethod[]>(['CASH']);
  protected readonly nonCashProvider = signal<'SIMULATOR' | 'DISABLED'>('DISABLED');
  protected readonly customers = signal<CustomerData[]>([]);
  protected readonly customerHistoryCustomer = signal<CustomerData | null>(null);
  protected readonly editingCustomer = signal<CustomerData | null>(null);
  protected readonly savingCustomer = signal(false);
  protected readonly customerError = signal<string | null>(null);
  protected readonly customerSuccess = signal<string | null>(null);
  protected readonly salesHistory = signal<SaleSummaryData[]>([]);
  protected readonly selectedSale = signal<SaleDetailData | null>(null);
  protected readonly loadingSales = signal(true);
  protected readonly loadingSaleDetail = signal(false);
  protected readonly salesError = signal<string | null>(null);
  protected readonly voidingSaleId = signal<string | null>(null);
  protected readonly saleVoidError = signal<string | null>(null);
  protected readonly saleVoidSuccess = signal<string | null>(null);
  protected readonly salesPage = signal(1);
  protected readonly salesTotalPages = signal(0);
  protected readonly salesTotal = signal(0);
  protected readonly salesCashReport = signal<SalesCashReportData | null>(null);
  protected readonly loadingSalesCashReport = signal(true);
  protected readonly salesCashReportError = signal<string | null>(null);
  protected readonly salesCashReportPage = signal(1);
  protected readonly salesCashReportTotalPages = signal(0);
  protected readonly auditEvents = signal<AuditEventData[]>([]);
  protected readonly loadingAudit = signal(true);
  protected readonly exportingAudit = signal(false);
  protected readonly auditError = signal<string | null>(null);
  protected readonly auditPage = signal(1);
  protected readonly auditTotalPages = signal(0);
  protected readonly auditTotal = signal(0);
  protected readonly auditIntegrity = signal(true);
  protected readonly auditRetentionDays = signal(365);
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
    if (this.savingAccess()) return 'Guardando acceso operativo…';
    if (this.switchingContext()) return 'Cambiando contexto operativo…';
    if (this.openingCashRegisterShift()) return 'Abriendo caja…';
    if (this.savingCashMovement()) return 'Registrando movimiento de caja…';
    if (this.reversingCashMovementId()) return 'Reversando movimiento de caja…';
    if (this.closingCashRegister()) return 'Cerrando caja y generando arqueo…';
    if (this.savingSale()) return 'Confirmando venta y actualizando inventario…';
    if (this.voidingSaleId()) return 'Anulando venta y restaurando inventario…';
    if (this.quotingCart()) return 'Validando precios y existencias…';
    return null;
  });
  protected readonly searchForm = this.formBuilder.nonNullable.group({
    q: ['', [Validators.maxLength(80)]],
    status: ['ACTIVE' as ProductStatusFilter],
    categoryId: [''],
    brandId: [''],
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
    q: ['', [Validators.maxLength(80)]],
    categoryId: [''],
    brandId: [''],
  });
  protected readonly paymentRows = this.formBuilder.array([this.createPaymentRow()]);
  protected readonly cashForm = this.formBuilder.nonNullable.group({
    customerId: [''],
  });
  protected readonly customerSearchForm = this.formBuilder.nonNullable.group({ q: [''] });
  protected readonly customerForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
    identifier: ['', [Validators.maxLength(80)]],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    phone: ['', [Validators.pattern(/^\+?[0-9 ()-]{7,32}$/)]],
    dataProcessingConsent: [false],
  });
  protected readonly cashRegisterShiftForm = this.formBuilder.nonNullable.group({
    openingAmount: ['0.00', [Validators.required, Validators.pattern(MONEY_PATTERN)]],
  });
  protected readonly cashMovementForm = this.formBuilder.nonNullable.group({
    type: ['INCOME' as 'INCOME' | 'WITHDRAWAL', [Validators.required]],
    amount: ['', [Validators.required, Validators.pattern(POSITIVE_MONEY_PATTERN)]],
    reason: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
  });
  protected readonly cashMovementReversalForm = this.formBuilder.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
  });
  protected readonly cashClosureForm = this.formBuilder.nonNullable.group({
    countedAmount: ['', [Validators.required, Validators.pattern(MONEY_PATTERN)]],
    differenceReason: ['', [Validators.maxLength(160)]],
    denominations: ['', [Validators.maxLength(240)]],
  });
  protected readonly salesFilterForm = this.formBuilder.nonNullable.group({
    dateFrom: [''],
    dateTo: [''],
    cashRegisterId: [''],
    userId: [''],
  });
  protected readonly salesCashReportForm = this.formBuilder.nonNullable.group({
    dateFrom: [''],
    dateTo: [''],
    branchId: [''],
    cashRegisterId: [''],
    userId: [''],
    status: ['ALL' as 'ALL' | 'COMPLETED' | 'VOIDED'],
  });
  protected readonly auditFilterForm = this.formBuilder.nonNullable.group({
    q: ['', [Validators.maxLength(100)]],
    action: ['', [Validators.maxLength(64)]],
    entityType: ['', [Validators.maxLength(48)]],
    dateFrom: [''],
    dateTo: [''],
  });
  protected readonly saleVoidForm = this.formBuilder.nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(240)]],
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
    cashRegisterId: [''],
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
  protected readonly cashRegisterForm = this.formBuilder.nonNullable.group({
    branchId: ['', [Validators.required]],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    code: ['', [Validators.required, Validators.pattern(LOCATION_CODE_PATTERN)]],
  });
  protected readonly accessRoleForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
  });
  protected readonly accessUserForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(12),
        Validators.maxLength(128),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/),
      ],
    ],
    roleId: ['', [Validators.required]],
    branchIds: this.formBuilder.nonNullable.control<string[]>([], Validators.required),
    cashRegisterIds: this.formBuilder.nonNullable.control<string[]>([]),
  });
  protected readonly accessAssignmentForm = this.formBuilder.nonNullable.group({
    userId: ['', [Validators.required]],
    roleId: ['', [Validators.required]],
    branchIds: this.formBuilder.nonNullable.control<string[]>([], Validators.required),
    cashRegisterIds: this.formBuilder.nonNullable.control<string[]>([]),
  });

  ngOnInit(): void {
    this.loadOrganization();
    if (this.canManageProducts() || this.canManageStock() || this.canManageSales()) {
      this.loadOptions();
    }
    if (this.canManageProducts() || this.canManageStock()) this.loadProducts(1);
    if (this.canManageStock()) {
      this.loadLocations();
      this.loadStockList(1);
      this.loadMovementHistory(1);
      this.loadTransfers();
    }
    if (this.canManageSales()) {
      this.loadPaymentOptions();
      this.loadCurrentCashRegisterShift();
      this.loadLatestCashClosure();
      this.loadSales(1);
      this.loadSalesCashReport(1);
      this.loadCustomers();
    }
    if (this.canViewAudit()) this.loadAuditEvents();
    if (this.canManageAccess()) this.loadAccess();
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

  protected contextCashRegisters() {
    return (
      this.organizations().find(({ id }) => id === this.contextForm.controls.branchId.value)
        ?.cashRegisters ?? []
    );
  }

  protected accessUserCashRegisters() {
    return this.cashRegistersForBranches(this.accessUserForm.controls.branchIds.value);
  }

  protected accessAssignmentCashRegisters() {
    return this.cashRegistersForBranches(this.accessAssignmentForm.controls.branchIds.value);
  }

  protected contextBranchChanged(): void {
    const currentWarehouse = this.contextForm.controls.warehouseId.value;
    const warehouses = this.contextWarehouses();
    if (!warehouses.some(({ id }) => id === currentWarehouse)) {
      this.contextForm.controls.warehouseId.setValue(warehouses[0]?.id ?? '');
    }
    const registers = this.contextCashRegisters();
    const currentRegister = this.contextForm.controls.cashRegisterId.value;
    if (!registers.some(({ id }) => id === currentRegister)) {
      this.contextForm.controls.cashRegisterId.setValue(registers[0]?.id ?? '');
    }
  }

  protected accessUserBranchesChanged(): void {
    const available = new Set(this.accessUserCashRegisters().map(({ id }) => id));
    this.accessUserForm.controls.cashRegisterIds.setValue(
      this.accessUserForm.controls.cashRegisterIds.value.filter((id) => available.has(id)),
    );
  }

  protected accessAssignmentBranchesChanged(): void {
    const available = new Set(this.accessAssignmentCashRegisters().map(({ id }) => id));
    this.accessAssignmentForm.controls.cashRegisterIds.setValue(
      this.accessAssignmentForm.controls.cashRegisterIds.value.filter((id) => available.has(id)),
    );
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
    const { branchId, warehouseId, cashRegisterId } = this.contextForm.getRawValue();
    if (
      branchId === this.session()?.context.branch?.id &&
      warehouseId === this.session()?.context.warehouse?.id &&
      cashRegisterId === (this.session()?.context.cashRegister?.id ?? '')
    ) {
      return;
    }
    this.switchingContext.set(true);
    this.organizationError.set(null);
    this.organizationSuccess.set(null);
    this.sessions
      .changeContext(branchId, warehouseId, cashRegisterId || undefined)
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
          this.currentCashRegisterShift.set(null);
          this.pendingShiftOpening = null;
          this.cashRegisterShiftError.set(null);
          this.cashRegisterShiftSuccess.set(null);
          this.cashRegisterMovements.set([]);
          this.expectedCash.set(null);
          this.cashMovementError.set(null);
          this.cashMovementSuccess.set(null);
          this.movementToReverse.set(null);
          this.pendingCashMovement = null;
          this.pendingCashReversal = null;
          this.latestCashClosure.set(null);
          this.cashClosureError.set(null);
          this.cashClosureSuccess.set(null);
          this.pendingCashClosure = null;
          this.selectedSale.set(null);
          this.salesHistory.set([]);
          if (this.canManageStock()) {
            this.loadLocations();
            this.loadStockList(1);
            this.loadMovementHistory(1);
            this.loadTransfers();
            this.syncTransferTargets();
          }
          if (this.canManageSales()) {
            this.loadCurrentCashRegisterShift();
            this.loadLatestCashClosure();
            this.loadSales(1);
          }
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

  protected submitCashRegister(): void {
    if (this.cashRegisterForm.invalid || this.savingOrganization()) {
      this.cashRegisterForm.markAllAsTouched();
      return;
    }
    const value = this.cashRegisterForm.getRawValue();
    this.savingOrganization.set(true);
    this.organizationError.set(null);
    this.organizationSuccess.set(null);
    this.organization
      .createCashRegister(value.branchId, {
        name: value.name.trim(),
        code: value.code.trim().toUpperCase(),
      })
      .pipe(finalize(() => this.savingOrganization.set(false)))
      .subscribe({
        next: () => {
          this.organizationSuccess.set('Caja creada y disponible para asignar.');
          this.cashRegisterForm.patchValue({ name: '', code: '' });
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

  protected classificationChanged(): void {
    this.searchForm.patchValue({ categoryId: '', brandId: '' });
    this.posSearchForm.patchValue({ categoryId: '', brandId: '' });
    this.loadOptions();
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
      IMPORT: 'Importación',
      STATE_TRANSITION: 'Cambio de estado',
      SALE: 'Venta',
      SALE_VOID: 'Anulación de venta',
      TRANSFER_OUT: 'Transferencia despachada',
      TRANSFER_IN: 'Transferencia en tránsito',
      TRANSFER_RECEIPT: 'Transferencia recibida',
      TRANSFER_DISCREPANCY: 'Diferencia de transferencia',
      PURCHASE_RECEIPT: 'Recepción de compra',
      SUPPLIER_RETURN: 'Devolución a proveedor',
    }[type];
  }

  protected movementDocumentLabel(type: InventoryMovementHistoryItem['document']['type']): string {
    return {
      MOVEMENT: 'Movimiento',
      IMPORT: 'Importación',
      SALE: 'Venta',
      TRANSFER: 'Transferencia',
      RECEIPT: 'Recepción',
      PURCHASE_RECEIPT: 'Recepción de compra',
      SUPPLIER_RETURN: 'Devolución a proveedor',
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

  protected inventoryImportConfirmed(): void {
    this.loadStockList(1);
    this.loadMovementHistory(1);
    this.loadAuditEvents();
    const selected = this.selectedProduct();
    if (selected) this.loadBalance(selected.id);
  }

  protected inventoryCountClosed(): void {
    this.inventoryImportConfirmed();
  }

  protected openCashRegisterShift(): void {
    if (this.cashRegisterShiftForm.invalid || this.openingCashRegisterShift()) {
      this.cashRegisterShiftForm.markAllAsTouched();
      return;
    }
    const openingAmount = this.cashRegisterShiftForm.controls.openingAmount.value.trim();
    const pending = this.pendingShiftOpening;
    const idempotencyKey =
      pending?.openingAmount === openingAmount
        ? pending.key
        : `web-shift-${globalThis.crypto.randomUUID()}`;
    this.pendingShiftOpening = { openingAmount, key: idempotencyKey };
    this.openingCashRegisterShift.set(true);
    this.cashRegisterShiftError.set(null);
    this.cashRegisterShiftSuccess.set(null);
    this.pos
      .openShift(openingAmount, idempotencyKey)
      .pipe(finalize(() => this.openingCashRegisterShift.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.pendingShiftOpening = null;
          this.currentCashRegisterShift.set(data);
          this.cashRegisterShiftSuccess.set('Caja abierta y lista para vender.');
          this.loadCashMovements();
        },
        error: (error: HttpErrorResponse) => {
          if (error.status > 0 && error.status < 500) this.pendingShiftOpening = null;
          this.cashRegisterShiftError.set(this.cashRegisterShiftMessageFor(error));
        },
      });
  }

  protected submitCashMovement(): void {
    if (this.cashMovementForm.invalid || this.savingCashMovement()) {
      this.cashMovementForm.markAllAsTouched();
      return;
    }
    const value = this.cashMovementForm.getRawValue();
    const input = {
      type: value.type,
      amount: value.amount.trim(),
      reason: value.reason.trim(),
    };
    const pending = this.pendingCashMovement;
    const key =
      pending && JSON.stringify(pending.input) === JSON.stringify(input)
        ? pending.key
        : `web-cash-movement-${globalThis.crypto.randomUUID()}`;
    this.pendingCashMovement = { input, key };
    this.savingCashMovement.set(true);
    this.cashMovementError.set(null);
    this.cashMovementSuccess.set(null);
    this.pos
      .createCashMovement(input, key)
      .pipe(finalize(() => this.savingCashMovement.set(false)))
      .subscribe({
        next: () => {
          this.pendingCashMovement = null;
          this.cashMovementForm.reset({ type: value.type, amount: '', reason: '' });
          this.cashMovementSuccess.set(
            value.type === 'INCOME' ? 'Ingreso confirmado.' : 'Egreso confirmado.',
          );
          this.loadCashMovements();
          this.loadAuditEvents();
        },
        error: (error: HttpErrorResponse) => {
          if (error.status > 0 && error.status < 500) this.pendingCashMovement = null;
          this.cashMovementError.set(this.cashMovementMessageFor(error));
        },
      });
  }

  protected startCashMovementReversal(movement: CashRegisterMovementData): void {
    if (movement.type === 'REVERSAL' || movement.reversed) return;
    this.movementToReverse.set(movement);
    this.cashMovementReversalForm.reset({ reason: '' });
    this.cashMovementError.set(null);
  }

  protected cancelCashMovementReversal(): void {
    this.movementToReverse.set(null);
    this.pendingCashReversal = null;
    this.cashMovementReversalForm.reset({ reason: '' });
  }

  protected reverseCashMovement(): void {
    const movement = this.movementToReverse();
    if (!movement || this.cashMovementReversalForm.invalid || this.reversingCashMovementId()) {
      this.cashMovementReversalForm.markAllAsTouched();
      return;
    }
    const reason = this.cashMovementReversalForm.controls.reason.value.trim();
    const pending = this.pendingCashReversal;
    const key =
      pending?.movementId === movement.id && pending.reason === reason
        ? pending.key
        : `web-cash-reversal-${globalThis.crypto.randomUUID()}`;
    this.pendingCashReversal = { movementId: movement.id, reason, key };
    this.reversingCashMovementId.set(movement.id);
    this.cashMovementError.set(null);
    this.cashMovementSuccess.set(null);
    this.pos
      .reverseCashMovement(movement.id, reason, key)
      .pipe(finalize(() => this.reversingCashMovementId.set(null)))
      .subscribe({
        next: () => {
          this.pendingCashReversal = null;
          this.movementToReverse.set(null);
          this.cashMovementSuccess.set('Reversa confirmada y saldo actualizado.');
          this.loadCashMovements();
          this.loadAuditEvents();
        },
        error: (error: HttpErrorResponse) => {
          if (error.status > 0 && error.status < 500) this.pendingCashReversal = null;
          this.cashMovementError.set(this.cashMovementMessageFor(error));
        },
      });
  }

  protected cashMovementLabel(movement: CashRegisterMovementData): string {
    if (movement.type === 'INCOME') return 'Ingreso';
    if (movement.type === 'WITHDRAWAL') return 'Egreso';
    return `Reversa de ${movement.reversalOf?.type === 'INCOME' ? 'ingreso' : 'egreso'}`;
  }

  protected closeCashRegisterShift(): void {
    if (this.cashClosureForm.invalid || this.closingCashRegister()) {
      this.cashClosureForm.markAllAsTouched();
      return;
    }
    const value = this.cashClosureForm.getRawValue();
    const denominations = this.parseCashDenominations(value.denominations);
    if (denominations === null) {
      this.cashClosureError.set('Usa denominaciones con formato 200x2, 50x1.');
      return;
    }
    const input = {
      countedAmount: value.countedAmount.trim(),
      ...(value.differenceReason.trim() ? { differenceReason: value.differenceReason.trim() } : {}),
      ...(denominations.length > 0 ? { denominations } : {}),
    };
    const pending = this.pendingCashClosure;
    const key =
      pending && JSON.stringify(pending.input) === JSON.stringify(input)
        ? pending.key
        : `web-cash-closure-${globalThis.crypto.randomUUID()}`;
    this.pendingCashClosure = { input, key };
    this.closingCashRegister.set(true);
    this.cashClosureError.set(null);
    this.cashClosureSuccess.set(null);
    this.pos
      .closeShift(input, key)
      .pipe(finalize(() => this.closingCashRegister.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.pendingCashClosure = null;
          this.latestCashClosure.set(data);
          this.currentCashRegisterShift.set(null);
          this.cashRegisterMovements.set([]);
          this.expectedCash.set(null);
          this.cart.set([]);
          this.cartQuote.set(null);
          this.completedSale.set(null);
          this.cashClosureSuccess.set('Caja cerrada. El arqueo quedó guardado.');
          this.loadSales(1);
          this.loadAuditEvents();
        },
        error: (error: HttpErrorResponse) => {
          if (error.status > 0 && error.status < 500) this.pendingCashClosure = null;
          this.cashClosureError.set(this.cashClosureMessageFor(error));
        },
      });
  }

  protected searchPos(): void {
    if (!this.assertOpenCashRegisterShift()) return;
    if (this.posSearchForm.invalid || this.searchingPos()) {
      this.posSearchForm.markAllAsTouched();
      return;
    }
    if (this.browserOffline()) {
      void this.searchPosOffline();
      return;
    }
    this.searchingPos.set(true);
    this.posError.set(null);
    this.products
      .list({
        q: this.posSearchForm.controls.q.value.trim(),
        ...(this.posSearchForm.controls.categoryId.value
          ? { categoryId: this.posSearchForm.controls.categoryId.value }
          : {}),
        ...(this.posSearchForm.controls.brandId.value
          ? { brandId: this.posSearchForm.controls.brandId.value }
          : {}),
        page: 1,
        pageSize: 5,
      })
      .pipe(finalize(() => this.searchingPos.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.offlinePosActive.set(false);
          this.posResults.set(data);
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 0) {
            void this.searchPosOffline();
            return;
          }
          this.posError.set(
            this.operationMessage(error, 'No fue posible buscar productos para la venta.'),
          );
        },
      });
  }

  protected searchCustomers(): void {
    this.loadCustomers();
  }

  protected editCustomer(customer: CustomerData): void {
    this.editingCustomer.set(customer);
    this.customerForm.setValue({
      name: customer.name,
      identifier: customer.identifier ?? '',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      dataProcessingConsent: customer.dataProcessingConsent,
    });
    this.customerError.set(null);
  }

  protected cancelCustomerEdit(): void {
    this.editingCustomer.set(null);
    this.customerForm.reset({
      name: '',
      identifier: '',
      email: '',
      phone: '',
      dataProcessingConsent: false,
    });
  }

  protected saveCustomer(): void {
    if (this.customerForm.invalid || this.savingCustomer()) {
      this.customerForm.markAllAsTouched();
      return;
    }
    const raw = this.customerForm.getRawValue();
    if ((raw.email.trim() || raw.phone.trim()) && !raw.dataProcessingConsent) {
      this.customerError.set('Autoriza el tratamiento de datos para guardar email o teléfono.');
      return;
    }
    const input: CustomerInput = {
      name: raw.name.trim(),
      ...(raw.identifier.trim() ? { identifier: raw.identifier.trim() } : {}),
      ...(raw.email.trim() ? { email: raw.email.trim().toLowerCase() } : {}),
      ...(raw.phone.trim() ? { phone: raw.phone.trim() } : {}),
      dataProcessingConsent: raw.dataProcessingConsent,
      active: true,
    };
    const current = this.editingCustomer();
    this.savingCustomer.set(true);
    this.customerError.set(null);
    this.customerSuccess.set(null);
    const operation = current
      ? this.customersApi.update(current.id, { ...input, version: current.version })
      : this.customersApi.create(input);
    operation.pipe(finalize(() => this.savingCustomer.set(false))).subscribe({
      next: ({ data }) => {
        this.customerSuccess.set(current ? 'Cliente actualizado.' : 'Cliente creado.');
        if (this.customerHistoryCustomer()?.id === data.id) {
          this.customerHistoryCustomer.set(data);
        }
        this.cancelCustomerEdit();
        this.loadCustomers();
        this.cashForm.controls.customerId.setValue(data.id);
      },
      error: (error: HttpErrorResponse) => {
        this.customerError.set(
          typeof error.error?.message === 'string'
            ? error.error.message
            : 'No fue posible guardar el cliente.',
        );
      },
    });
  }

  protected deactivateCustomer(customer: CustomerData): void {
    this.customersApi.deactivate(customer.id).subscribe({
      next: () => {
        if (this.cashForm.controls.customerId.value === customer.id)
          this.cashForm.controls.customerId.setValue('');
        this.customerSuccess.set('Cliente desactivado; su historial se conserva.');
        this.loadCustomers();
      },
      error: (error: HttpErrorResponse) => {
        this.customerError.set(
          typeof error.error?.message === 'string'
            ? error.error.message
            : 'No fue posible desactivar el cliente.',
        );
      },
    });
  }

  protected openCustomerHistory(customer: CustomerData): void {
    this.customerHistoryCustomer.set(customer);
  }

  protected openCustomerSale(saleId: string): void {
    this.selectSale(saleId);
    document.getElementById('sales-title')?.scrollIntoView({ behavior: 'smooth' });
  }

  protected addToCart(product: ProductData): void {
    if (!this.assertOpenCashRegisterShift()) return;
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
    if (!this.assertOpenCashRegisterShift()) return;
    const quote = this.cartQuote();
    if (!quote || this.cashForm.invalid || this.savingSale()) {
      this.cashForm.markAllAsTouched();
      return;
    }
    if (!this.paymentsMatchTotal(quote.totals.total)) {
      this.posError.set('La suma de pagos debe coincidir exactamente con el total de la venta.');
      this.paymentRows.markAllAsTouched();
      return;
    }
    const input = {
      lines: this.cart().map((entry) => ({
        productId: entry.product.id,
        quantity: entry.quantity,
      })),
      ...(this.cashForm.controls.customerId.value
        ? { customerId: this.cashForm.controls.customerId.value }
        : {}),
      payments: this.paymentRows.controls.map((row) => {
        const value = row.getRawValue();
        return {
          method: value.method,
          amount: value.amount.trim(),
          ...(value.method === 'CASH'
            ? { amountReceived: value.amountReceived.trim() }
            : { reference: value.reference.trim() }),
        };
      }),
    };
    const pending = this.pendingSale;
    const idempotencyKey =
      pending && JSON.stringify(pending.input) === JSON.stringify(input)
        ? pending.key
        : `web-sale-${globalThis.crypto.randomUUID()}`;
    this.pendingSale = { input, key: idempotencyKey };
    if (this.browserOffline()) {
      const offlinePayment = input.payments[0];
      if (input.payments.length !== 1 || offlinePayment?.method !== 'CASH') {
        this.pendingSale = null;
        this.posError.set('Los pagos distintos de efectivo requieren conexión al servidor.');
        return;
      }
      void this.queueOfflineCashSale(
        {
          lines: input.lines,
          cashReceived: 'amountReceived' in offlinePayment ? offlinePayment.amountReceived : '',
          ...(input.customerId ? { customerId: input.customerId } : {}),
        },
        idempotencyKey,
        quote,
      );
      return;
    }
    this.savingSale.set(true);
    this.posError.set(null);
    this.pos.createSale(input, idempotencyKey).subscribe({
      next: ({ data }) => {
        this.savingSale.set(false);
        this.pendingSale = null;
        this.completedSale.set(data);
        this.cart.set([]);
        this.cartQuote.set(null);
        this.resetPaymentForm();
        this.loadStockList(this.stockPage());
        this.loadMovementHistory(1);
        this.loadSales(1);
        this.loadCashMovements();
        this.loadAuditEvents();
        const selected = this.selectedProduct();
        if (selected) this.loadBalance(selected.id);
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 0) {
          const offlinePayment = input.payments[0];
          if (input.payments.length === 1 && offlinePayment?.method === 'CASH') {
            void this.queueOfflineCashSale(
              {
                lines: input.lines,
                cashReceived:
                  'amountReceived' in offlinePayment ? offlinePayment.amountReceived : '',
                ...(input.customerId ? { customerId: input.customerId } : {}),
              },
              idempotencyKey,
              quote,
            );
          } else {
            this.savingSale.set(false);
            this.pendingSale = null;
            this.posError.set('Los pagos distintos de efectivo requieren conexión al servidor.');
          }
          return;
        }
        this.savingSale.set(false);
        if (error.status > 0 && error.status < 500) this.pendingSale = null;
        this.posError.set(this.posMessageFor(error));
      },
    });
  }

  protected changePaymentMethod(index: number): void {
    const row = this.paymentRows.at(index);
    const method = row.controls.method.value;
    const cash = row.controls.amountReceived;
    const reference = row.controls.reference;
    if (method === 'CASH') {
      cash.setValidators([Validators.required, Validators.pattern(MONEY_PATTERN)]);
      reference.clearValidators();
      reference.setValue('');
      if (this.paymentRows.length === 1 && this.cartQuote()) {
        cash.setValue(this.cartQuote()!.totals.total);
      }
    } else {
      cash.clearValidators();
      cash.setValue('');
      reference.setValidators([
        Validators.required,
        Validators.minLength(4),
        Validators.maxLength(120),
        Validators.pattern(PAYMENT_REFERENCE_PATTERN),
      ]);
    }
    cash.updateValueAndValidity();
    reference.updateValueAndValidity();
    this.posError.set(null);
  }

  protected addPayment(): void {
    const method = this.paymentMethods().find(
      (candidate) =>
        !this.paymentRows.controls.some((row) => row.controls.method.value === candidate),
    );
    if (!method) return;
    if (this.paymentRows.length === 1) {
      this.paymentRows.at(0).controls.amount.setValue('');
      this.paymentRows.at(0).controls.amountReceived.setValue('');
    }
    this.paymentRows.push(this.createPaymentRow(method));
    this.posError.set(null);
  }

  protected removePayment(index: number): void {
    if (this.paymentRows.length === 1) return;
    this.paymentRows.removeAt(index);
    if (this.paymentRows.length === 1) this.syncSinglePaymentAmount();
    this.posError.set(null);
  }

  protected canAddPayment(): boolean {
    return this.paymentRows.length < this.paymentMethods().length;
  }

  protected availablePaymentMethods(index: number): PaymentMethod[] {
    const current = this.paymentRows.at(index).controls.method.value;
    const used = new Set(this.paymentRows.controls.map((row) => row.controls.method.value));
    return this.paymentMethods().filter((method) => method === current || !used.has(method));
  }

  protected paymentMethodLabel(method: PaymentMethod | 'MIXED'): string {
    return {
      CASH: 'Efectivo',
      CARD: 'Tarjeta',
      TRANSFER: 'Transferencia',
      VOUCHER: 'Vale',
      MIXED: 'Mixto',
    }[method];
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

  protected filterSalesCashReport(): void {
    this.loadSalesCashReport(1);
  }

  protected previousSalesCashReportPage(): void {
    if (this.salesCashReportPage() > 1) {
      this.loadSalesCashReport(this.salesCashReportPage() - 1);
    }
  }

  protected nextSalesCashReportPage(): void {
    if (this.salesCashReportPage() < this.salesCashReportTotalPages()) {
      this.loadSalesCashReport(this.salesCashReportPage() + 1);
    }
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
    this.saleVoidError.set(null);
    this.saleVoidSuccess.set(null);
    this.saleVoidForm.reset({ reason: '' });
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

  protected voidSelectedSale(): void {
    const sale = this.selectedSale();
    if (
      !sale ||
      sale.status !== 'COMPLETED' ||
      !this.canVoidSales() ||
      !this.currentCashRegisterShift() ||
      this.saleVoidForm.invalid ||
      this.voidingSaleId()
    ) {
      this.saleVoidForm.markAllAsTouched();
      return;
    }
    const reason = this.saleVoidForm.controls.reason.value.trim();
    const pending = this.pendingSaleVoid;
    const key =
      pending?.saleId === sale.id && pending.reason === reason
        ? pending.key
        : `web-sale-void-${globalThis.crypto.randomUUID()}`;
    this.pendingSaleVoid = { saleId: sale.id, reason, key };
    this.voidingSaleId.set(sale.id);
    this.saleVoidError.set(null);
    this.saleVoidSuccess.set(null);
    this.pos
      .voidSale(sale.id, reason, key)
      .pipe(finalize(() => this.voidingSaleId.set(null)))
      .subscribe({
        next: ({ data }) => {
          this.pendingSaleVoid = null;
          this.selectedSale.set(data);
          this.salesHistory.update((items) =>
            items.map((item) => (item.id === data.id ? { ...item, status: data.status } : item)),
          );
          this.saleVoidForm.reset({ reason: '' });
          this.saleVoidSuccess.set(`Venta ${data.receiptNumber} anulada y stock restaurado.`);
          this.loadStockList(this.stockPage());
          this.loadMovementHistory(1);
          this.loadCashMovements();
          this.loadAuditEvents();
          const product = this.selectedProduct();
          if (product) this.loadBalance(product.id);
        },
        error: (error: HttpErrorResponse) => {
          if (error.status > 0 && error.status < 500) this.pendingSaleVoid = null;
          this.saleVoidError.set(this.saleVoidMessageFor(error));
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
        CASH_REGISTER_CREATED: 'Caja creada',
        INVENTORY_IMPORT_PREVIEWED: 'Importación de inventario previsualizada',
        INVENTORY_IMPORT_CONFIRMED: 'Importación de inventario confirmada',
        SALE_COMPLETED: 'Venta completada',
        SALE_VOIDED: 'Venta anulada',
        ACCESS_ROLE_CREATED: 'Rol operativo creado',
        ACCESS_USER_CREATED: 'Usuario operativo creado',
        ACCESS_USER_UPDATED: 'Acceso operativo actualizado',
        AUDIT_QUERY_EXECUTED: 'Consulta de auditoría ejecutada',
        AUDIT_EXPORT_CREATED: 'Exportación de auditoría creada',
        SUPPLIER_CREATED: 'Proveedor creado',
        SUPPLIER_UPDATED: 'Proveedor actualizado',
        SUPPLIER_DEACTIVATED: 'Proveedor desactivado',
        SUPPLIER_PRODUCT_LINKED: 'Producto relacionado con proveedor',
        SUPPLIER_PRICE_CHANGED: 'Precio de proveedor actualizado',
        PURCHASE_ORDER_CREATED: 'Orden de compra creada',
        PURCHASE_ORDER_UPDATED: 'Orden de compra actualizada',
        PURCHASE_ORDER_APPROVED: 'Orden de compra aprobada',
        PURCHASE_ORDER_SENT: 'Orden de compra enviada',
        PURCHASE_ORDER_CANCELLED: 'Orden de compra cancelada',
      }[action] ?? action
    );
  }

  protected filterAuditEvents(): void {
    const value = this.auditFilterForm.getRawValue();
    if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
      this.auditError.set('La fecha inicial no puede ser posterior a la fecha final.');
      return;
    }
    this.loadAuditEvents(1);
  }

  protected previousAuditPage(): void {
    if (this.auditPage() > 1) this.loadAuditEvents(this.auditPage() - 1);
  }

  protected nextAuditPage(): void {
    if (this.auditPage() < this.auditTotalPages()) {
      this.loadAuditEvents(this.auditPage() + 1);
    }
  }

  protected exportAuditEvents(): void {
    if (!this.canExportAudit() || this.exportingAudit()) return;
    this.exportingAudit.set(true);
    this.auditError.set(null);
    this.audit
      .export(this.auditQuery(this.auditPage()))
      .pipe(finalize(() => this.exportingAudit.set(false)))
      .subscribe({
        next: (file) => {
          const url = URL.createObjectURL(file);
          const link = document.createElement('a');
          link.href = url;
          link.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
          link.click();
          URL.revokeObjectURL(url);
          this.loadAuditEvents(1);
        },
        error: (error: HttpErrorResponse) =>
          this.auditError.set(
            this.operationMessage(error, 'No fue posible exportar la auditoría.'),
          ),
      });
  }

  protected locationChanged(): void {
    const product = this.selectedProduct();
    if (product) this.loadBalance(product.id);
  }

  protected recordMovement(): void {
    if (!this.canAdjustInventory()) return;
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
    if (!this.canAdjustInventory()) return;
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
    if (!this.canTransferInventory()) return;
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
    if (!this.canApproveInventory() || this.transferActionId()) return;
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
    if (!this.canApproveInventory() || this.transferActionId()) return;
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
      this.canTransferInventory() &&
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
    if (!this.canTransferInventory() || this.transferActionId()) return;
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

  protected permissionLabel(permission: AppPermission): string {
    return {
      TENANT_MANAGE: 'Administrar empresa y sucursales',
      PRODUCTS_MANAGE: 'Administrar productos',
      SALES_MANAGE: 'Operar ventas',
      SALES_VOID: 'Anular ventas',
      SALES_DISCOUNT: 'Aplicar descuentos',
      SALE_REPRINT: 'Reimprimir comprobantes',
      CASH_REGISTER_OPEN: 'Abrir caja',
      CASH_REGISTER_CLOSE: 'Cerrar caja y realizar arqueo',
      CASH_REGISTER_MOVE: 'Registrar y reversar movimientos de caja',
      ACCESS_MANAGE: 'Administrar roles y usuarios',
      AUDIT_VIEW: 'Consultar auditoría',
      AUDIT_EXPORT: 'Exportar auditoría',
      SUPPLIERS_MANAGE: 'Administrar proveedores',
      PURCHASE_ORDERS_MANAGE: 'Crear y editar órdenes de compra',
      PURCHASE_ORDERS_APPROVE: 'Aprobar y cancelar órdenes de compra',
      PURCHASE_RECEIPTS_OVERAGE: 'Recibir sobrantes de órdenes de compra',
      INVENTORY_VIEW: 'Consultar inventario e historial',
      INVENTORY_ADJUST: 'Registrar entradas, salidas y ajustes',
      INVENTORY_TRANSFER: 'Crear y recibir transferencias',
      INVENTORY_COUNT: 'Realizar conteos',
      INVENTORY_APPROVE: 'Despachar, cancelar y aprobar operaciones',
    }[permission];
  }

  protected toggleRolePermission(permission: AppPermission, checked: boolean): void {
    const current = this.selectedRolePermissions();
    this.selectedRolePermissions.set(
      checked
        ? Array.from(new Set([...current, permission]))
        : current.filter((candidate) => candidate !== permission),
    );
  }

  protected createAccessRole(): void {
    if (
      this.accessRoleForm.invalid ||
      this.selectedRolePermissions().length === 0 ||
      this.savingAccess()
    ) {
      this.accessRoleForm.markAllAsTouched();
      if (this.selectedRolePermissions().length === 0) {
        this.accessError.set('Selecciona al menos un permiso para el rol.');
      }
      return;
    }
    this.savingAccess.set(true);
    this.accessError.set(null);
    this.accessSuccess.set(null);
    this.access
      .createRole(this.accessRoleForm.controls.name.value.trim(), this.selectedRolePermissions())
      .pipe(finalize(() => this.savingAccess.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.accessSuccess.set(`Rol ${data.name} creado.`);
          this.accessRoleForm.reset({ name: '' });
          this.selectedRolePermissions.set(['INVENTORY_VIEW']);
          this.loadAccess();
          this.loadAuditEvents();
        },
        error: (error: HttpErrorResponse) =>
          this.accessError.set(this.operationMessage(error, 'No fue posible crear el rol.')),
      });
  }

  protected createAccessUser(): void {
    if (this.accessUserForm.invalid || this.savingAccess()) {
      this.accessUserForm.markAllAsTouched();
      return;
    }
    const value = this.accessUserForm.getRawValue();
    if (this.roleRequiresCashRegister(value.roleId) && value.cashRegisterIds.length === 0) {
      this.accessError.set('Selecciona al menos una caja para un rol de ventas.');
      return;
    }
    this.savingAccess.set(true);
    this.accessError.set(null);
    this.accessSuccess.set(null);
    this.access
      .createUser(
        value.email.trim(),
        value.password,
        [value.roleId],
        value.branchIds,
        value.cashRegisterIds,
      )
      .pipe(finalize(() => this.savingAccess.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.accessSuccess.set(`Acceso creado para ${data.email}.`);
          this.accessUserForm.controls.email.setValue('');
          this.accessUserForm.controls.password.setValue('');
          this.loadAccess();
          this.loadAuditEvents();
        },
        error: (error: HttpErrorResponse) =>
          this.accessError.set(this.operationMessage(error, 'No fue posible crear el acceso.')),
      });
  }

  protected assignmentUserChanged(): void {
    const user = this.accessUsers().find(
      ({ id }) => id === this.accessAssignmentForm.controls.userId.value,
    );
    this.accessAssignmentForm.controls.roleId.setValue(user?.roles[0]?.id ?? '');
    this.accessAssignmentForm.controls.branchIds.setValue(user?.branches.map(({ id }) => id) ?? []);
    this.accessAssignmentForm.controls.cashRegisterIds.setValue(
      user?.cashRegisters?.map(({ id }) => id) ?? [],
    );
  }

  protected updateAccessUser(): void {
    if (this.accessAssignmentForm.invalid || this.savingAccess()) {
      this.accessAssignmentForm.markAllAsTouched();
      return;
    }
    const value = this.accessAssignmentForm.getRawValue();
    if (this.roleRequiresCashRegister(value.roleId) && value.cashRegisterIds.length === 0) {
      this.accessError.set('Selecciona al menos una caja para un rol de ventas.');
      return;
    }
    this.savingAccess.set(true);
    this.accessError.set(null);
    this.accessSuccess.set(null);
    this.access
      .updateUser(value.userId, [value.roleId], value.branchIds, value.cashRegisterIds)
      .pipe(finalize(() => this.savingAccess.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.accessSuccess.set(
            `Permisos de ${data.email} actualizados; sus sesiones se cerraron.`,
          );
          this.loadAccess();
          this.loadAuditEvents();
        },
        error: (error: HttpErrorResponse) =>
          this.accessError.set(
            this.operationMessage(error, 'No fue posible actualizar el acceso.'),
          ),
      });
  }

  private loadAccess(): void {
    this.loadingAccess.set(true);
    this.accessError.set(null);
    forkJoin({ roles: this.access.listRoles(), users: this.access.listUsers() })
      .pipe(finalize(() => this.loadingAccess.set(false)))
      .subscribe({
        next: ({ roles, users }) => {
          this.accessRoles.set(roles.data);
          this.accessUsers.set(users.data);
          const firstRoleId = roles.data[0]?.id ?? '';
          const firstBranchId = this.activeBranches()[0]?.id ?? '';
          if (!this.accessUserForm.controls.roleId.value) {
            this.accessUserForm.controls.roleId.setValue(firstRoleId);
          }
          if (this.accessUserForm.controls.branchIds.value.length === 0 && firstBranchId) {
            this.accessUserForm.controls.branchIds.setValue([firstBranchId]);
          }
          const manageable = users.data.find(({ manageable }) => manageable);
          if (!this.accessAssignmentForm.controls.userId.value && manageable) {
            this.accessAssignmentForm.controls.userId.setValue(manageable.id);
            this.assignmentUserChanged();
          }
        },
        error: (error: HttpErrorResponse) =>
          this.accessError.set(
            this.operationMessage(error, 'No fue posible cargar roles y usuarios.'),
          ),
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
            cashRegisterId:
              branch?.cashRegisters?.find(
                ({ id }) => id === this.session()?.context.cashRegister?.id,
              )?.id ??
              branch?.cashRegisters?.[0]?.id ??
              '',
          });
          if (!this.warehouseForm.controls.branchId.value) {
            this.warehouseForm.controls.branchId.setValue(branch?.id ?? '');
          }
          if (!this.cashRegisterForm.controls.branchId.value) {
            this.cashRegisterForm.controls.branchId.setValue(branch?.id ?? '');
          }
          this.syncTransferTargets();
          if (
            this.canManageAccess() &&
            this.accessUserForm.controls.branchIds.value.length === 0 &&
            branch
          ) {
            this.accessUserForm.controls.branchIds.setValue([branch.id]);
          }
        },
        error: (error: HttpErrorResponse) =>
          this.organizationError.set(
            this.operationMessage(error, 'No fue posible cargar sucursales y bodegas.'),
          ),
      });
  }

  private cashRegistersForBranches(branchIds: string[]) {
    const selected = new Set(branchIds);
    return this.activeBranches().flatMap((branch) =>
      selected.has(branch.id)
        ? (branch.cashRegisters ?? []).map((register) => ({ ...register, branchId: branch.id }))
        : [],
    );
  }

  private roleRequiresCashRegister(roleId: string): boolean {
    return (
      this.accessRoles()
        .find(({ id }) => id === roleId)
        ?.permissions.includes('SALES_MANAGE') ?? false
    );
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
    const categoryId = this.searchForm.controls.categoryId.value;
    const brandId = this.searchForm.controls.brandId.value;
    this.products
      .list({
        ...(q ? { q } : {}),
        ...(status === 'ACTIVE' ? {} : { status }),
        ...(categoryId ? { categoryId } : {}),
        ...(brandId ? { brandId } : {}),
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

  private loadSalesCashReport(page: number): void {
    this.loadingSalesCashReport.set(true);
    this.salesCashReportError.set(null);
    const value = this.salesCashReportForm.getRawValue();
    this.pos
      .salesCashReport({
        ...(value.dateFrom ? { dateFrom: value.dateFrom } : {}),
        ...(value.dateTo ? { dateTo: value.dateTo } : {}),
        ...(value.branchId ? { branchId: value.branchId } : {}),
        ...(value.cashRegisterId ? { cashRegisterId: value.cashRegisterId } : {}),
        ...(value.userId ? { userId: value.userId } : {}),
        status: value.status,
        page,
        pageSize: 10,
      })
      .pipe(finalize(() => this.loadingSalesCashReport.set(false)))
      .subscribe({
        next: ({ data, meta }) => {
          this.salesCashReport.set(data);
          this.salesCashReportPage.set(meta.pagination.page);
          this.salesCashReportTotalPages.set(meta.pagination.totalPages);
        },
        error: (error: HttpErrorResponse) => {
          this.salesCashReport.set(null);
          this.salesCashReportError.set(
            this.operationMessage(error, 'No fue posible cargar el reporte de ventas y caja.'),
          );
        },
      });
  }

  private loadCustomers(): void {
    const q = this.customerSearchForm.controls.q.value.trim();
    this.customerError.set(null);
    this.customersApi
      .list({ ...(q ? { q } : {}), status: 'ACTIVE', page: 1, pageSize: 50 })
      .subscribe({
        next: ({ data }) => this.customers.set(data),
        error: (error: HttpErrorResponse) => {
          this.customers.set([]);
          this.customerError.set(
            this.operationMessage(error, 'No fue posible cargar los clientes.'),
          );
        },
      });
  }

  private loadCurrentCashRegisterShift(): void {
    this.loadingCashRegisterShift.set(true);
    this.cashRegisterShiftError.set(null);
    this.pos
      .getCurrentShift()
      .pipe(finalize(() => this.loadingCashRegisterShift.set(false)))
      .subscribe({
        next: ({ data }) => {
          this.currentCashRegisterShift.set(data);
          if (data) this.loadCashMovements();
          else {
            this.cashRegisterMovements.set([]);
            this.expectedCash.set(null);
          }
        },
        error: (error: HttpErrorResponse) => {
          this.currentCashRegisterShift.set(null);
          this.cashRegisterShiftError.set(this.cashRegisterShiftMessageFor(error));
        },
      });
  }

  private loadCashMovements(): void {
    if (!this.currentCashRegisterShift()) return;
    this.loadingCashMovements.set(true);
    this.cashMovementError.set(null);
    this.pos
      .listCashMovements()
      .pipe(finalize(() => this.loadingCashMovements.set(false)))
      .subscribe({
        next: ({ data, meta }) => {
          this.cashRegisterMovements.set(data);
          this.expectedCash.set(meta.expectedCash);
          if (this.cashClosureForm.controls.countedAmount.pristine) {
            this.cashClosureForm.controls.countedAmount.setValue(meta.expectedCash);
          }
        },
        error: (error: HttpErrorResponse) => {
          this.cashRegisterMovements.set([]);
          this.expectedCash.set(null);
          this.cashMovementError.set(this.cashMovementMessageFor(error));
        },
      });
  }

  private loadLatestCashClosure(): void {
    this.loadingCashClosure.set(true);
    this.pos
      .getLatestClosure()
      .pipe(finalize(() => this.loadingCashClosure.set(false)))
      .subscribe({
        next: ({ data }) => this.latestCashClosure.set(data),
        error: (error: HttpErrorResponse) =>
          this.cashClosureError.set(
            this.operationMessage(error, 'No fue posible consultar el último arqueo.'),
          ),
      });
  }

  private loadAuditEvents(page = 1): void {
    this.loadingAudit.set(true);
    this.auditError.set(null);
    this.audit
      .list(this.auditQuery(page))
      .pipe(finalize(() => this.loadingAudit.set(false)))
      .subscribe({
        next: ({ data, meta }) => {
          this.auditEvents.set(data);
          this.auditPage.set(meta.pagination.page);
          this.auditTotalPages.set(meta.pagination.totalPages);
          this.auditTotal.set(meta.pagination.total);
          this.auditIntegrity.set(meta.integrity.valid);
          this.auditRetentionDays.set(meta.retention.minimumDays);
        },
        error: (error: HttpErrorResponse) => {
          this.auditEvents.set([]);
          this.auditError.set(this.operationMessage(error, 'No fue posible cargar la auditoría.'));
        },
      });
  }

  private auditQuery(page: number) {
    const value = this.auditFilterForm.getRawValue();
    return {
      ...(value.q.trim() ? { q: value.q.trim() } : {}),
      ...(value.action.trim() ? { action: value.action.trim() } : {}),
      ...(value.entityType.trim() ? { entityType: value.entityType.trim() } : {}),
      ...(value.dateFrom ? { dateFrom: value.dateFrom } : {}),
      ...(value.dateTo ? { dateTo: value.dateTo } : {}),
      page,
      pageSize: 20,
    };
  }

  private quoteCart(): void {
    if (!this.assertOpenCashRegisterShift()) return;
    if (this.cart().length === 0) return;
    if (this.browserOffline()) {
      void this.quoteCartOffline();
      return;
    }
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
          this.offlinePosActive.set(false);
          this.cartQuote.set(data);
          this.syncSinglePaymentAmount();
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 0) {
            void this.quoteCartOffline();
            return;
          }
          this.cartQuote.set(null);
          this.posError.set(this.posMessageFor(error));
        },
      });
  }

  private async searchPosOffline(): Promise<void> {
    this.searchingPos.set(true);
    this.posError.set(null);
    try {
      this.posResults.set(
        await this.offlinePos.search(this.posSearchForm.controls.q.value, {
          ...(this.posSearchForm.controls.categoryId.value
            ? { categoryId: this.posSearchForm.controls.categoryId.value }
            : {}),
          ...(this.posSearchForm.controls.brandId.value
            ? { brandId: this.posSearchForm.controls.brandId.value }
            : {}),
        }),
      );
      this.offlinePosActive.set(true);
    } catch (error) {
      this.posResults.set([]);
      this.posError.set(
        error instanceof Error ? error.message : 'No fue posible consultar el catálogo offline.',
      );
    } finally {
      this.searchingPos.set(false);
    }
  }

  private async quoteCartOffline(): Promise<void> {
    this.quotingCart.set(true);
    this.posError.set(null);
    try {
      const quote = await this.offlinePos.quote(
        this.cart().map((entry) => ({
          productId: entry.product.id,
          quantity: entry.quantity,
        })),
      );
      this.cartQuote.set(quote);
      this.syncSinglePaymentAmount();
      this.offlinePosActive.set(true);
    } catch (error) {
      this.cartQuote.set(null);
      this.posError.set(
        error instanceof Error ? error.message : 'No fue posible cotizar el carrito offline.',
      );
    } finally {
      this.quotingCart.set(false);
    }
  }

  private async queueOfflineCashSale(
    input: {
      lines: Array<{ productId: string; quantity: string }>;
      cashReceived: string;
      customerId?: string;
    },
    idempotencyKey: string,
    quote: PosCartQuote,
  ): Promise<void> {
    this.savingSale.set(true);
    this.posError.set(null);
    try {
      const command = await this.offlinePos.queueCashSale(quote, input, idempotencyKey);
      this.pendingSale = null;
      this.completedSale.set(null);
      this.queuedOfflineSale.set({ commandId: command.commandId, total: quote.totals.total });
      this.cart.set([]);
      this.cartQuote.set(null);
      this.resetPaymentForm();
      this.offlinePosActive.set(true);
    } catch (error) {
      this.posError.set(
        error instanceof Error ? error.message : 'No fue posible guardar la venta offline.',
      );
    } finally {
      this.savingSale.set(false);
    }
  }

  private browserOffline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  }

  private loadPaymentOptions(): void {
    this.pos.getPaymentOptions().subscribe({
      next: ({ data }) => {
        this.paymentMethods.set(data.methods);
        this.nonCashProvider.set(data.nonCashProvider);
        for (const [index, row] of this.paymentRows.controls.entries()) {
          if (!data.methods.includes(row.controls.method.value)) {
            row.controls.method.setValue(data.methods[0] ?? 'CASH');
            this.changePaymentMethod(index);
          }
        }
      },
      error: () => {
        this.paymentMethods.set(['CASH']);
        this.nonCashProvider.set('DISABLED');
      },
    });
  }

  private resetPaymentForm(): void {
    this.cashForm.reset({ customerId: '' });
    this.paymentRows.clear();
    this.paymentRows.push(this.createPaymentRow());
    this.syncSinglePaymentAmount();
  }

  private createPaymentRow(method: PaymentMethod = 'CASH') {
    const row = this.formBuilder.nonNullable.group({
      method: [method, [Validators.required]],
      amount: ['', [Validators.required, Validators.pattern(POSITIVE_MONEY_PATTERN)]],
      amountReceived: [''],
      reference: [''],
    });
    if (method === 'CASH') {
      row.controls.amountReceived.setValidators([
        Validators.required,
        Validators.pattern(MONEY_PATTERN),
      ]);
    } else {
      row.controls.reference.setValidators([
        Validators.required,
        Validators.minLength(4),
        Validators.maxLength(120),
        Validators.pattern(PAYMENT_REFERENCE_PATTERN),
      ]);
    }
    row.controls.amountReceived.updateValueAndValidity();
    row.controls.reference.updateValueAndValidity();
    return row;
  }

  private syncSinglePaymentAmount(): void {
    if (this.paymentRows.length !== 1 || !this.cartQuote()) return;
    const row = this.paymentRows.at(0);
    row.controls.amount.setValue(this.cartQuote()!.totals.total);
    if (row.controls.method.value === 'CASH') {
      row.controls.amountReceived.setValue(this.cartQuote()!.totals.total);
    }
  }

  private paymentsMatchTotal(total: string): boolean {
    if (this.paymentRows.invalid) return false;
    const toCents = (value: string) => {
      const [whole, fraction = ''] = value.split('.');
      return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    };
    return (
      this.paymentRows.controls.reduce(
        (sum, row) => sum + toCents(row.controls.amount.value),
        0n,
      ) === toCents(total)
    );
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
    if (code === 'PAYMENT_DECLINED') return 'El pago fue rechazado. Usa otra referencia o método.';
    if (code === 'PAYMENT_REFERENCE_REUSED') {
      return 'La referencia de pago ya fue utilizada.';
    }
    if (code === 'PAYMENT_METHOD_UNAVAILABLE') {
      return 'Ese método de pago no está disponible en este ambiente.';
    }
    if (code === 'CASH_REGISTER_SHIFT_REQUIRED') {
      this.currentCashRegisterShift.set(null);
      return 'Abre la caja antes de operar el punto de venta.';
    }
    if (code === 'IDEMPOTENCY_KEY_REUSED') {
      return 'La venta cambió durante el reintento. Revisa el carrito e intenta nuevamente.';
    }
    if (error.status === 403) return this.permissionMessage();
    if (error.status === 0) return 'No pudimos conectar con el servicio. Intenta nuevamente.';
    return 'No fue posible completar la venta.';
  }

  private saleVoidMessageFor(error: HttpErrorResponse): string {
    const code = (error.error as { code?: string } | null)?.code;
    if (code === 'SALE_ALREADY_VOIDED') {
      return 'La venta ya fue anulada. Actualiza el historial.';
    }
    if (code === 'SALE_VOID_NOT_ALLOWED') {
      return 'La venta no puede anularse porque su turno de caja ya fue cerrado.';
    }
    if (code === 'IDEMPOTENCY_KEY_REUSED') {
      return 'El motivo cambió durante el reintento. Revísalo e intenta nuevamente.';
    }
    return this.operationMessage(error, 'No fue posible anular la venta.');
  }

  private cashRegisterShiftMessageFor(error: HttpErrorResponse): string {
    const code = (error.error as { code?: string } | null)?.code;
    if (code === 'CASH_REGISTER_ALREADY_OPEN') {
      return 'Esta caja o tu usuario ya tienen un turno abierto. Actualiza el contexto.';
    }
    if (code === 'IDEMPOTENCY_KEY_REUSED') {
      return 'El fondo de apertura cambió durante el reintento. Intenta nuevamente.';
    }
    return this.operationMessage(error, 'No fue posible abrir la caja.');
  }

  private cashMovementMessageFor(error: HttpErrorResponse): string {
    const code = (error.error as { code?: string } | null)?.code;
    if (code === 'INSUFFICIENT_EXPECTED_CASH') {
      return 'El egreso o la reversa dejaría un saldo esperado negativo.';
    }
    if (code === 'CASH_REGISTER_MOVEMENT_ALREADY_REVERSED') {
      return 'El movimiento ya fue reversado. Actualiza el historial.';
    }
    if (code === 'IDEMPOTENCY_KEY_REUSED') {
      return 'El movimiento cambió durante el reintento. Revísalo e intenta nuevamente.';
    }
    if (code === 'CASH_REGISTER_SHIFT_REQUIRED') {
      this.currentCashRegisterShift.set(null);
      return 'Abre la caja antes de registrar movimientos.';
    }
    return this.operationMessage(error, 'No fue posible procesar el movimiento de caja.');
  }

  private cashClosureMessageFor(error: HttpErrorResponse): string {
    const code = (error.error as { code?: string } | null)?.code;
    if (code === 'DENOMINATION_TOTAL_MISMATCH') {
      return 'La suma de denominaciones no coincide con el efectivo contado.';
    }
    if (code === 'CASH_DIFFERENCE_REASON_REQUIRED') {
      return 'Explica el sobrante o faltante antes de cerrar la caja.';
    }
    if (code === 'CASH_REGISTER_ALREADY_CLOSED') {
      return 'Este turno ya fue cerrado. Consulta el último arqueo.';
    }
    if (code === 'IDEMPOTENCY_KEY_REUSED') {
      return 'El conteo cambió durante el reintento. Revísalo e intenta nuevamente.';
    }
    return this.operationMessage(error, 'No fue posible cerrar la caja.');
  }

  private parseCashDenominations(
    value: string,
  ): Array<{ denomination: string; quantity: number }> | null {
    const text = value.trim();
    if (!text) return [];
    const parsed: Array<{ denomination: string; quantity: number }> = [];
    for (const token of text.split(',')) {
      const match = token.trim().match(/^(.+?)\s*[xX]\s*(\d+)$/);
      if (!match) return null;
      const denomination = match[1].trim();
      const quantity = Number(match[2]);
      if (
        !POSITIVE_MONEY_PATTERN.test(denomination) ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 100_000
      ) {
        return null;
      }
      parsed.push({ denomination, quantity });
    }
    return parsed;
  }

  private assertOpenCashRegisterShift(): boolean {
    if (this.currentCashRegisterShift()) return true;
    this.posError.set('Abre la caja antes de operar el punto de venta.');
    return false;
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
    this.queuedOfflineSale.set(null);
    this.pendingSale = null;
  }
}
