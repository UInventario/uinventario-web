export const CONTROLLER_UI = {
  AccessControlController: [
    'administration',
    '/app/administration/access',
    'UIN-181',
    'Roles y acceso',
  ],
  AccountingController: [
    'integrations',
    '/app/administration/integrations/accounting',
    'UIN-203',
    'Contabilidad',
  ],
  AuditController: ['reporting', '/app/reports/audit', 'UIN-199', 'Auditoría'],
  CatalogClassificationController: [
    'catalog',
    '/app/catalog/classifications',
    'UIN-187',
    'Categorías y marcas',
  ],
  CatalogController: ['catalog', '/app/catalog/products', 'UIN-187', 'Productos'],
  CommerceAdminController: [
    'integrations',
    '/app/administration/integrations/commerce',
    'UIN-204',
    'E-commerce',
  ],
  CommerceExternalController: ['external', null, 'UIN-204', 'API externa de comercio'],
  CustomerController: ['sales', '/app/sales/customers', 'UIN-190', 'Clientes'],
  CustomerCreditPaymentController: [
    'sales',
    '/app/sales/customers/:customerId/credit',
    'UIN-198',
    'Abonos de crédito',
  ],
  CustomerOrderController: ['sales', '/app/sales/orders', 'UIN-201', 'Pedidos'],
  CustomerOrderShippingController: [
    'sales',
    '/app/sales/orders/:orderId/shipping',
    'UIN-201',
    'Retiro y despacho',
  ],
  DataExportController: ['reporting', '/app/reports/exports', 'UIN-199', 'Exportaciones'],
  DemandForecastController: ['dashboard', '/app/dashboard', 'UIN-183', 'Pronóstico'],
  ErpIntegrationController: [
    'integrations',
    '/app/administration/integrations/erp',
    'UIN-203',
    'ERP',
  ],
  ExternalAdapterController: [
    'integrations',
    '/app/administration/integrations',
    'UIN-203',
    'Adaptadores externos',
  ],
  FiscalContractController: [
    'integrations',
    '/app/administration/integrations/fiscal',
    'UIN-203',
    'Contrato fiscal',
  ],
  FiscalSimulatorController: [
    'integrations',
    '/app/administration/integrations/fiscal/simulator',
    'UIN-203',
    'Simulador fiscal',
  ],
  HealthController: ['infrastructure', null, 'UIN-209', 'Salud del servicio'],
  InventoryController: [
    'inventory',
    '/app/inventory/stock',
    'UIN-189',
    'Existencias y movimientos',
  ],
  InventoryCountController: ['inventory', '/app/inventory/counts', 'UIN-191', 'Conteos físicos'],
  InventoryStockAlertController: [
    'inventory',
    '/app/inventory/alerts',
    'UIN-191',
    'Alertas de stock',
  ],
  InventoryTransferController: [
    'inventory',
    '/app/inventory/transfers',
    'UIN-193',
    'Transferencias',
  ],
  LoyaltyController: ['sales', '/app/sales/loyalty', 'UIN-197', 'Fidelización'],
  MobileSessionController: ['mobile-only', null, 'UIN-179', 'Sesión Mobile'],
  NotificationController: ['dashboard', '/app/notifications', 'UIN-183', 'Notificaciones'],
  OfflineBootstrapController: ['offline', '/app/sync', 'UIN-202', 'Sincronización'],
  OnboardingController: ['administration', '/onboarding', 'UIN-182', 'Configuración inicial'],
  OrganizationController: [
    'administration',
    '/app/administration/organization',
    'UIN-182',
    'Organización',
  ],
  PasswordResetController: ['identity', '/recover', 'UIN-178', 'Recuperar contraseña'],
  PaymentTerminalController: ['pos', '/app/sales/pos/payments', 'UIN-198', 'Terminal de pago'],
  PosController: ['pos', '/app/sales/pos', 'UIN-194', 'Punto de venta'],
  PosPeripheralController: ['desktop', '/app/sales/pos/peripherals', 'UIN-205', 'Periféricos POS'],
  PriceListController: ['catalog', '/app/catalog/price-lists', 'UIN-197', 'Listas de precios'],
  PrivacyController: ['administration', '/app/administration/privacy', 'UIN-190', 'Privacidad'],
  ProductReservationController: ['sales', '/app/sales/reservations', 'UIN-201', 'Reservas'],
  PromotionController: ['catalog', '/app/catalog/promotions', 'UIN-197', 'Promociones'],
  PspPaymentController: ['integrations', '/app/administration/integrations/psp', 'UIN-203', 'PSP'],
  PurchaseOrderController: [
    'procurement',
    '/app/procurement/orders',
    'UIN-188',
    'Órdenes de compra',
  ],
  RegistrationController: ['identity', '/register', 'UIN-178', 'Registro'],
  ResendWebhookController: ['webhook', null, 'UIN-203', 'Webhook de correo'],
  SaleFiscalDocumentController: [
    'sales',
    '/app/sales/history/:saleId/fiscal',
    'UIN-200',
    'Documento fiscal',
  ],
  SaleReceiptController: [
    'sales',
    '/app/sales/history/:saleId/receipt',
    'UIN-200',
    'Ticket de venta',
  ],
  SaleReturnController: ['sales', '/app/sales/returns', 'UIN-200', 'Devoluciones'],
  SalesReportDetailController: [
    'reporting',
    '/app/reports/sales/:saleId',
    'UIN-196',
    'Detalle de venta y devoluciones',
  ],
  SalesQuotationController: ['sales', '/app/sales/quotations', 'UIN-201', 'Cotizaciones'],
  SessionController: ['identity', '/login', 'UIN-179', 'Sesión Web'],
  SupplierController: ['procurement', '/app/procurement/suppliers', 'UIN-184', 'Proveedores'],
  SupplierProductController: [
    'procurement',
    '/app/procurement/suppliers/:supplierId/products',
    'UIN-184',
    'Productos de proveedor',
  ],
  SuspendedSaleController: ['pos', '/app/sales/pos/suspended', 'UIN-200', 'Ventas suspendidas'],
  WhatsappController: [
    'integrations',
    '/app/administration/integrations/whatsapp',
    'UIN-203',
    'WhatsApp',
  ],
};

export const DOMAIN_FILES = {
  administration: 'administration.jsonl',
  catalog: 'catalog.jsonl',
  dashboard: 'dashboard.jsonl',
  desktop: 'desktop.jsonl',
  external: 'external.jsonl',
  identity: 'identity.jsonl',
  infrastructure: 'infrastructure.jsonl',
  integrations: 'integrations.jsonl',
  inventory: 'inventory.jsonl',
  'mobile-only': 'mobile-only.jsonl',
  offline: 'offline.jsonl',
  pos: 'pos.jsonl',
  procurement: 'procurement.jsonl',
  reporting: 'reporting.jsonl',
  sales: 'sales.jsonl',
  webhook: 'webhook.jsonl',
};

export const NO_WEB_UI_DOMAINS = new Set(['external', 'infrastructure', 'mobile-only', 'webhook']);

export const NO_WEB_UI_OPERATIONS = new Map([
  ['PasswordResetController#localMailbox', 'test-support endpoint; exercised only by Playwright'],
]);

export const NO_WEB_UI_REASONS = {
  external: 'third-party API contract; no first-party Web screen',
  infrastructure: 'deployment health probe; verified by Cloud Build',
  'mobile-only': 'Mobile authentication contract; excluded from Web UI',
  webhook: 'inbound provider webhook; verified by integration tests',
};

export const OPERATION_UI_OVERRIDES = new Map([
  [
    'CatalogController#updateProductVariants',
    ['/app/catalog/products/:id/variants', 'UIN-185', 'Variantes'],
  ],
  ['CatalogController#updateProductKit', ['/app/catalog/products/:id/kit', 'UIN-185', 'Kits']],
  [
    'InventoryController#previewImport',
    ['/app/inventory/imports', 'UIN-191', 'Importar inventario'],
  ],
  [
    'InventoryController#getImport',
    ['/app/inventory/imports/:importId', 'UIN-191', 'Importar inventario'],
  ],
  [
    'InventoryController#confirmImport',
    ['/app/inventory/imports/:importId', 'UIN-191', 'Importar inventario'],
  ],
  [
    'InventoryController#operateKit',
    ['/app/inventory/kits/:productId', 'UIN-185', 'Operación de kit'],
  ],
  [
    'InventoryController#listLotExpirationAlerts',
    ['/app/inventory/lots/expirations', 'UIN-192', 'Vencimientos'],
  ],
  ['InventoryController#listLots', ['/app/inventory/products/:productId/lots', 'UIN-192', 'Lotes']],
  [
    'InventoryController#listSerials',
    ['/app/inventory/products/:productId/serials', 'UIN-192', 'Series'],
  ],
  [
    'InventoryController#serialHistory',
    ['/app/inventory/serials/:serialId', 'UIN-192', 'Trazabilidad serial'],
  ],
  [
    'InventoryController#listFifoLayers',
    ['/app/inventory/valuation', 'UIN-186', 'Valorización FIFO'],
  ],
  [
    'InventoryController#runReconciliation',
    ['/app/inventory/reconciliation', 'UIN-186', 'Reconciliación'],
  ],
  [
    'InventoryController#getReconciliation',
    ['/app/inventory/reconciliation/:runId', 'UIN-186', 'Reconciliación'],
  ],
  [
    'InventoryController#latestReconciliation',
    ['/app/inventory/reconciliation', 'UIN-186', 'Reconciliación'],
  ],
  [
    'InventoryController#getValuationPolicy',
    ['/app/inventory/valuation/policy', 'UIN-186', 'Política de valorización'],
  ],
  [
    'InventoryController#changeValuationPolicy',
    ['/app/inventory/valuation/policy', 'UIN-186', 'Política de valorización'],
  ],
  [
    'InventoryController#previewValuationPolicy',
    ['/app/inventory/valuation/policy', 'UIN-186', 'Política de valorización'],
  ],
  [
    'InventoryController#activityReport',
    ['/app/reports/inventory-activity', 'UIN-196', 'Actividad de inventario'],
  ],
  [
    'InventoryController#activityMovements',
    ['/app/reports/inventory-activity/:productId', 'UIN-196', 'Actividad de inventario'],
  ],
  ['PosController#openShift', ['/app/sales/pos/register', 'UIN-195', 'Caja']],
  ['PosController#currentShift', ['/app/sales/pos/register', 'UIN-195', 'Caja']],
  ['PosController#closeShift', ['/app/sales/pos/register', 'UIN-195', 'Caja']],
  [
    'PosController#listCashMovements',
    ['/app/sales/pos/register/movements', 'UIN-195', 'Movimientos de caja'],
  ],
  [
    'PosController#createCashMovement',
    ['/app/sales/pos/register/movements', 'UIN-195', 'Movimientos de caja'],
  ],
  [
    'PosController#reverseCashMovement',
    ['/app/sales/pos/register/movements', 'UIN-195', 'Movimientos de caja'],
  ],
  [
    'PosController#latestClosedShift',
    ['/app/sales/pos/register/history', 'UIN-195', 'Cierres de caja'],
  ],
  ['PosController#profitabilityReport', ['/app/reports/profitability', 'UIN-196', 'Rentabilidad']],
  ['PosController#salesCashReport', ['/app/reports/sales-cash', 'UIN-196', 'Ventas y caja']],
  ['PosController#listSales', ['/app/sales/history', 'UIN-196', 'Historial de ventas']],
  ['PosController#getSale', ['/app/sales/history/:saleId', 'UIN-196', 'Detalle de venta']],
  ['PosController#voidSale', ['/app/sales/history/:saleId/void', 'UIN-200', 'Anular venta']],
  ['PosController#createSale', ['/app/sales/pos', 'UIN-194; UIN-198', 'Completar venta']],
  ['PosController#createCashSale', ['/app/sales/pos', 'UIN-194; UIN-198', 'Venta en efectivo']],
  ['PosController#paymentOptions', ['/app/sales/pos/payments', 'UIN-198', 'Opciones de pago']],
]);
