import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export type InventoryMovementType =
  | 'INITIAL'
  | 'ENTRY'
  | 'EXIT'
  | 'RETURN'
  | 'LOSS'
  | 'DAMAGE'
  | 'ADJUSTMENT'
  | 'IMPORT'
  | 'STATE_TRANSITION'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'TRANSFER_RECEIPT'
  | 'TRANSFER_DISCREPANCY'
  | 'SALE'
  | 'SALE_VOID'
  | 'PURCHASE_RECEIPT'
  | 'SUPPLIER_RETURN';

export type InventoryStockState = 'AVAILABLE' | 'RESERVED' | 'DAMAGED' | 'IN_TRANSIT';

export type InventoryValuationMethod = 'MOVING_AVERAGE' | 'FIFO' | 'SPECIFIC_LOT';

export interface InventoryValuationPolicyData {
  method: InventoryValuationMethod;
  version: number;
  effectiveAt: string;
  migrationRule: 'INITIAL_DEFAULT' | 'FORWARD_ONLY_CUTOVER';
}

export interface InventoryValuationMigrationPlan {
  current: InventoryValuationPolicyData;
  targetMethod: InventoryValuationMethod;
  allowed: boolean;
  blockingReasons: string[];
  strategy:
    | 'USE_MAINTAINED_MOVING_AVERAGE'
    | 'USE_MAINTAINED_FIFO_LAYERS'
    | 'OPENING_LOTS_AT_MOVING_AVERAGE';
  productsToMigrate: number;
  locationsToMigrate: number;
  devicesToRebootstrap: number;
  planFingerprint: string;
}

export type InventoryReconciliationStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL';

export interface InventoryReconciliationFindingData {
  id: string;
  code: string;
  severity: 'WARNING' | 'CRITICAL';
  scopeType: 'TENANT' | 'PRODUCT' | 'LOCATION' | 'LOT' | 'SERIAL' | 'VALUATION';
  product: { id: string; name: string; sku: string } | null;
  location: InventoryLocationData | null;
  subjectReference: string | null;
  expectedValue: string | null;
  actualValue: string | null;
  differenceValue: string | null;
  message: string;
  recommendedAction: string;
  blocksOperations: boolean;
}

export interface InventoryReconciliationRunData {
  id: string;
  status: 'RUNNING' | 'COMPLETED';
  overallStatus: InventoryReconciliationStatus;
  summary: { findings: number; warnings: number; critical: number };
  policy: { releaseBlocked: boolean; operationsBlocked: boolean };
  correlationId: string;
  responsible: { id: string; email: string };
  startedAt: string;
  finishedAt: string | null;
  findings: InventoryReconciliationFindingData[];
}

export interface InventoryStateQuantity {
  code: InventoryStockState;
  quantity: string;
}

export interface InventoryLocationData {
  id: string;
  name: string;
  code: string;
}

export interface InventoryBalanceData {
  product: { id: string; name: string; sku: string };
  location: InventoryLocationData;
  quantity: string;
  availableQuantity?: string;
  totalQuantity?: string;
  states?: InventoryStateQuantity[];
}

export interface InventoryMovementInput {
  productId: string;
  locationId: string;
  type: Exclude<
    InventoryMovementType,
    | 'STATE_TRANSITION'
    | 'IMPORT'
    | 'TRANSFER_OUT'
    | 'TRANSFER_IN'
    | 'TRANSFER_RECEIPT'
    | 'TRANSFER_DISCREPANCY'
    | 'SALE'
    | 'SALE_VOID'
    | 'PURCHASE_RECEIPT'
    | 'SUPPLIER_RETURN'
  >;
  quantity: string;
  reason: string;
  reference?: string;
  lotCode?: string;
  serialNumbers?: string[];
}

export interface InventoryStateTransitionInput {
  productId: string;
  locationId: string;
  fromState: InventoryStockState;
  toState: InventoryStockState;
  quantity: string;
  reason: string;
  reference: string;
  serialNumbers?: string[];
}

export interface InventoryStockItem {
  product: { id: string; name: string; sku: string; active: boolean; trackLots: boolean };
  availableQuantity: string;
  totalQuantity: string;
  states: InventoryStateQuantity[];
  averageUnitCost?: string;
  inventoryValue?: string;
  costing: {
    method: InventoryValuationMethod;
    currency: string;
    quantity: string;
    inventoryValue: string;
    reconciled: boolean;
  };
  valuation?: {
    quantity: string;
    inventoryValue: string;
    quantityReconciled?: boolean;
    valueReconciled?: boolean;
    reconciled: boolean;
  };
  lotTracking?: {
    lotQuantity: string;
    reconciled: boolean;
    currency: string | null;
    inventoryValue: string;
  } | null;
  fifoValuation?: {
    quantity: string;
    inventoryValue: string;
    currency: string | null;
    reconciled: boolean;
  };
}

export interface InventoryStockValuationReport {
  method: InventoryValuationMethod;
  policyVersion: number;
  effectiveAt: string;
  currency: string;
  asOf: string;
}

export interface InventoryLotData {
  id: string;
  code: string;
  product: { id: string; name: string; sku: string };
  quantity: string;
  unitCost: string;
  currency: string;
  inventoryValue: string;
  createdAt: string;
  origins: Array<{
    purchaseReceiptLineId: string;
    quantity: string;
    unitCost: string;
    currency: string;
    receipt: { id: string; documentReference: string };
    purchaseOrder: { id: string; folio: string };
  }>;
  balances: Array<{ location: InventoryLocationData; quantity: string }>;
}

export interface InventoryFifoLayerData {
  id: string;
  product: { id: string; name: string; sku: string };
  location: InventoryLocationData;
  originType: 'MIGRATION_CUT' | 'ENTRY' | 'PURCHASE_RECEIPT' | 'RETURN' | 'TRANSFER';
  originalQuantity: string;
  remainingQuantity: string;
  unitCost: string;
  currency: string;
  inventoryValue: string;
  acquiredAt: string;
  source: {
    movementId: string | null;
    movementType: InventoryMovementType | null;
    reference: string | null;
    layerId: string | null;
    purchaseReceiptLineId: string | null;
  };
}

export type InventorySerialStatus =
  'AVAILABLE' | 'RESERVED' | 'DAMAGED' | 'IN_TRANSIT' | 'SOLD' | 'RETURNED_TO_SUPPLIER' | 'REMOVED';

export interface InventorySerialData {
  id: string;
  serialNumber: string;
  status: InventorySerialStatus;
  product: { id: string; name: string; sku: string };
  currentLocation: InventoryLocationData | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventorySerialEventData {
  id: string;
  movement: { id: string; type: InventoryMovementType; reference: string | null; reason: string };
  fromStatus: InventorySerialStatus | null;
  toStatus: InventorySerialStatus;
  fromLocation: InventoryLocationData | null;
  toLocation: InventoryLocationData | null;
  responsible: { id: string; email: string };
  createdAt: string;
}

export interface InventoryMovementHistoryItem {
  id: string;
  type: InventoryMovementType;
  direction: 'IN' | 'OUT' | 'TRANSFER';
  quantityChange: string;
  previousQuantity: string;
  resultingQuantity: string;
  reason: string;
  reference: string | null;
  createdAt: string;
  product: { id: string; name: string; sku: string };
  location: {
    id: string;
    name: string;
    code: string;
    warehouse: { id: string; name: string };
  };
  responsible: { id: string; email: string };
  correlationId: string;
  idempotencyKey: string;
  document: {
    type:
      | 'MOVEMENT'
      | 'IMPORT'
      | 'SALE'
      | 'TRANSFER'
      | 'RECEIPT'
      | 'PURCHASE_RECEIPT'
      | 'SUPPLIER_RETURN';
    id: string;
    reference: string | null;
  };
  stateTransition: {
    from: InventoryStockState;
    to: InventoryStockState;
    quantity: string;
  } | null;
  valuation?: {
    method: InventoryValuationMethod;
    policyVersion: number;
    effectiveAt: string;
    unitCost: string;
    valueChange: string;
    resultingInventoryValue: string | null;
    averageUnitCost: string | null;
  } | null;
  lots?: Array<{
    id: string;
    code: string;
    quantityChange: string;
    unitCost: string;
    currency: string;
    valueChange: string;
    selectionMode: 'ORIGIN' | 'MANUAL' | 'AUTOMATIC' | 'RESTORE' | 'TRANSFER';
  }>;
  fifoValuation?: {
    unitCost: string;
    valueChange: string;
    resultingInventoryValue: string;
  } | null;
  fifoLayers?: Array<{
    allocationId: string;
    layerId: string;
    sourceAllocationId: string | null;
    quantityChange: string;
    unitCost: string;
    currency: string;
    valueChange: string;
    selectionMode: 'ENTRY' | 'FIFO' | 'RESTORE' | 'TRANSFER' | 'ORIGIN_RETURN';
  }>;
}

interface LocationsResponse {
  data: InventoryLocationData[];
  meta: { apiVersion: '1' };
}

interface BalanceResponse {
  data: InventoryBalanceData;
  meta: { apiVersion: '1' };
}

interface MovementResponse {
  data: InventoryBalanceData & {
    id: string;
    type: InventoryMovementType;
    quantityChange: string;
    reason: string;
    reference: string | null;
    createdAt: string;
    stateTransition: {
      from: InventoryStockState;
      to: InventoryStockState;
      quantity: string;
    } | null;
  };
  meta: { apiVersion: '1'; idempotentReplay: boolean };
}

export interface StockListResponse {
  data: InventoryStockItem[];
  meta: {
    apiVersion: '1';
    policy: { negativeStock: 'DENY' };
    scope: {
      branch: { id: string; name: string };
      warehouse: { id: string; name: string };
    };
    valuation: InventoryStockValuationReport;
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  };
}

interface MovementListResponse {
  data: InventoryMovementHistoryItem[];
  meta: {
    apiVersion: '1';
    scope: { branch: { id: string; name: string } };
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  };
}

export type InventoryImportMode = 'INITIAL' | 'COUNT';

export interface InventoryImportData {
  id: string;
  mode: InventoryImportMode;
  status: 'PREVIEWED' | 'CONFIRMED';
  sourceFilename: string;
  policy: 'ATOMIC';
  canConfirm: boolean;
  summary: {
    rows: number;
    validRows: number;
    errorRows: number;
    movements: number | null;
  };
  rows: Array<{
    id: string;
    rowNumber: number;
    product: { id: string; name: string; sku: string } | null;
    location: InventoryLocationData | null;
    state: InventoryStockState | null;
    targetQuantity: string | null;
    currentQuantity: string | null;
    difference: string | null;
    reason: string;
    errors: Array<{ code: string; message: string }>;
  }>;
  confirmedAt: string | null;
}

interface InventoryImportResponse {
  data: InventoryImportData;
  meta: { apiVersion: '1'; idempotentReplay?: boolean };
}

export interface InventoryCountAttemptData {
  attempt: number;
  countedQuantity: string;
  responsible: { id: string; email: string };
  createdAt: string;
}

export interface InventoryCountSessionLineData {
  product: { id: string; name: string; sku: string };
  snapshotQuantity: string | null;
  countedQuantity: string | null;
  varianceQuantity: string | null;
  attemptCount: number;
  countedBy: { id: string; email: string } | null;
  countedAt: string | null;
  movementId: string | null;
  attempts: InventoryCountAttemptData[];
}

export interface InventoryCountSessionData {
  id: string;
  status: 'OPEN' | 'CLOSED';
  blind: boolean;
  branch: { id: string; name: string };
  warehouse: { id: string; name: string };
  location: InventoryLocationData;
  createdBy: { id: string; email: string };
  closedBy: { id: string; email: string } | null;
  createdAt: string;
  closedAt: string | null;
  lines: InventoryCountSessionLineData[];
}

interface InventoryCountSessionResponse {
  data: InventoryCountSessionData;
  meta: { apiVersion: '1'; idempotentReplay?: boolean };
}

interface InventoryCountSessionListResponse {
  data: InventoryCountSessionData[];
  meta: { apiVersion: '1' };
}

@Injectable({ providedIn: 'root' })
export class InventoryApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  listLocations() {
    return this.http.get<LocationsResponse>(`${this.config.apiBaseUrl()}/inventory/locations`, {
      withCredentials: true,
    });
  }

  getValuationPolicy() {
    return this.http.get<{ data: InventoryValuationPolicyData; meta: { apiVersion: '1' } }>(
      `${this.config.apiBaseUrl()}/inventory/valuation-policy`,
      { withCredentials: true },
    );
  }

  previewValuationPolicy(targetMethod: InventoryValuationMethod) {
    return this.http.post<{
      data: InventoryValuationMigrationPlan;
      meta: { apiVersion: '1' };
    }>(
      `${this.config.apiBaseUrl()}/inventory/valuation-policy/preview`,
      { targetMethod },
      { withCredentials: true },
    );
  }

  changeValuationPolicy(
    input: {
      targetMethod: InventoryValuationMethod;
      expectedVersion: number;
      planFingerprint: string;
    },
    idempotencyKey: string,
  ) {
    const headers = new HttpHeaders().set('Idempotency-Key', idempotencyKey);
    return this.http.post<{
      data: InventoryValuationPolicyData;
      meta: { apiVersion: '1'; replay: boolean };
    }>(`${this.config.apiBaseUrl()}/inventory/valuation-policy/changes`, input, {
      headers,
      withCredentials: true,
    });
  }

  latestReconciliation() {
    return this.http.get<{
      data: InventoryReconciliationRunData | null;
      meta: { apiVersion: '1' };
    }>(`${this.config.apiBaseUrl()}/inventory/reconciliations/latest`, {
      withCredentials: true,
    });
  }

  runReconciliation(idempotencyKey: string) {
    const headers = new HttpHeaders().set('Idempotency-Key', idempotencyKey);
    return this.http.post<{
      data: InventoryReconciliationRunData;
      meta: { apiVersion: '1'; idempotentReplay: boolean };
    }>(`${this.config.apiBaseUrl()}/inventory/reconciliations`, {}, {
      headers,
      withCredentials: true,
    });
  }

  listStock(query: {
    branchId?: string;
    warehouseId?: string;
    productId?: string;
    q?: string;
    page: number;
    pageSize: number;
  }) {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.branchId) params = params.set('branchId', query.branchId);
    if (query.warehouseId) params = params.set('warehouseId', query.warehouseId);
    if (query.productId) params = params.set('productId', query.productId);
    if (query.q) params = params.set('q', query.q);
    return this.http.get<StockListResponse>(`${this.config.apiBaseUrl()}/inventory/stock`, {
      params,
      withCredentials: true,
    });
  }

  listLots(productId: string) {
    return this.http.get<{
      data: InventoryLotData[];
      meta: {
        apiVersion: '1';
        tracked: boolean;
        totalQuantity: string;
        lotQuantity: string;
        reconciled: boolean;
        currency: string | null;
        inventoryValue: string;
      };
    }>(`${this.config.apiBaseUrl()}/inventory/products/${productId}/lots`, {
      withCredentials: true,
    });
  }

  listSerials(productId: string) {
    return this.http.get<{
      data: InventorySerialData[];
      meta: { apiVersion: '1'; tracked: boolean };
    }>(`${this.config.apiBaseUrl()}/inventory/products/${productId}/serials`, {
      withCredentials: true,
    });
  }

  serialHistory(serialId: string) {
    return this.http.get<{
      data: { serial: InventorySerialData; events: InventorySerialEventData[] };
      meta: { apiVersion: '1' };
    }>(`${this.config.apiBaseUrl()}/inventory/serials/${serialId}/history`, {
      withCredentials: true,
    });
  }

  listFifoLayers(productId: string) {
    return this.http.get<{
      data: InventoryFifoLayerData[];
      meta: {
        apiVersion: '1';
        method: 'FIFO';
        cutover: {
          effectiveAt: string;
          migrationRule: 'OPENING_BALANCE_AT_MOVING_AVERAGE';
        };
        totalQuantity: string;
        layerQuantity: string;
        reconciled: boolean;
        currency: string | null;
        inventoryValue: string;
      };
    }>(`${this.config.apiBaseUrl()}/inventory/products/${productId}/fifo-layers`, {
      withCredentials: true,
    });
  }

  listMovements(query: {
    q?: string;
    location?: string;
    responsible?: string;
    document?: string;
    type?: InventoryMovementType;
    dateFrom?: string;
    dateTo?: string;
    page: number;
    pageSize: number;
  }) {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.q) params = params.set('q', query.q);
    if (query.location) params = params.set('location', query.location);
    if (query.responsible) params = params.set('responsible', query.responsible);
    if (query.document) params = params.set('document', query.document);
    if (query.type) params = params.set('type', query.type);
    if (query.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query.dateTo) params = params.set('dateTo', query.dateTo);
    return this.http.get<MovementListResponse>(`${this.config.apiBaseUrl()}/inventory/movements`, {
      params,
      withCredentials: true,
    });
  }

  getBalance(productId: string, locationId: string) {
    const params = new HttpParams().set('locationId', locationId);
    return this.http.get<BalanceResponse>(
      `${this.config.apiBaseUrl()}/inventory/products/${productId}/balance`,
      { params, withCredentials: true },
    );
  }

  createMovement(input: InventoryMovementInput, idempotencyKey: string) {
    const headers = new HttpHeaders().set('Idempotency-Key', idempotencyKey);
    return this.http.post<MovementResponse>(
      `${this.config.apiBaseUrl()}/inventory/movements`,
      input,
      { headers, withCredentials: true },
    );
  }

  createStateTransition(input: InventoryStateTransitionInput, idempotencyKey: string) {
    const headers = new HttpHeaders().set('Idempotency-Key', idempotencyKey);
    return this.http.post<MovementResponse>(
      `${this.config.apiBaseUrl()}/inventory/state-transitions`,
      input,
      { headers, withCredentials: true },
    );
  }

  previewImport(file: File, mode: InventoryImportMode) {
    const form = new FormData();
    form.append('mode', mode);
    form.append('file', file, file.name);
    return this.http.post<InventoryImportResponse>(
      `${this.config.apiBaseUrl()}/inventory/imports/preview`,
      form,
      { withCredentials: true },
    );
  }

  confirmImport(importId: string, idempotencyKey: string) {
    const headers = new HttpHeaders().set('Idempotency-Key', idempotencyKey);
    return this.http.post<InventoryImportResponse>(
      `${this.config.apiBaseUrl()}/inventory/imports/${importId}/confirm`,
      {},
      { headers, withCredentials: true },
    );
  }

  listCountSessions() {
    return this.http.get<InventoryCountSessionListResponse>(
      `${this.config.apiBaseUrl()}/inventory/count-sessions`,
      { withCredentials: true },
    );
  }

  getCountSession(sessionId: string) {
    return this.http.get<InventoryCountSessionResponse>(
      `${this.config.apiBaseUrl()}/inventory/count-sessions/${sessionId}`,
      { withCredentials: true },
    );
  }

  createCountSession(
    input: { locationId: string; productIds: string[]; blind: boolean },
    idempotencyKey: string,
  ) {
    const headers = new HttpHeaders().set('Idempotency-Key', idempotencyKey);
    return this.http.post<InventoryCountSessionResponse>(
      `${this.config.apiBaseUrl()}/inventory/count-sessions`,
      input,
      { headers, withCredentials: true },
    );
  }

  recordCount(
    sessionId: string,
    productId: string,
    input: { countedQuantity: string; expectedAttempt: number },
  ) {
    return this.http.put<InventoryCountSessionResponse>(
      `${this.config.apiBaseUrl()}/inventory/count-sessions/${sessionId}/lines/${productId}`,
      input,
      { withCredentials: true },
    );
  }

  closeCountSession(sessionId: string, input: { reason: string; reference: string }) {
    return this.http.post<InventoryCountSessionResponse>(
      `${this.config.apiBaseUrl()}/inventory/count-sessions/${sessionId}/close`,
      input,
      { withCredentials: true },
    );
  }
}
