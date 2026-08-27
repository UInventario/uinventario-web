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
  | 'PURCHASE_RECEIPT';

export type InventoryStockState = 'AVAILABLE' | 'RESERVED' | 'DAMAGED' | 'IN_TRANSIT';

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
  >;
  quantity: string;
  reason: string;
  reference?: string;
}

export interface InventoryStateTransitionInput {
  productId: string;
  locationId: string;
  fromState: InventoryStockState;
  toState: InventoryStockState;
  quantity: string;
  reason: string;
  reference: string;
}

export interface InventoryStockItem {
  product: { id: string; name: string; sku: string; active: boolean };
  availableQuantity: string;
  totalQuantity: string;
  states: InventoryStateQuantity[];
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
    type: 'MOVEMENT' | 'IMPORT' | 'SALE' | 'TRANSFER' | 'RECEIPT' | 'PURCHASE_RECEIPT';
    id: string;
    reference: string | null;
  };
  stateTransition: {
    from: InventoryStockState;
    to: InventoryStockState;
    quantity: string;
  } | null;
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

@Injectable({ providedIn: 'root' })
export class InventoryApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  listLocations() {
    return this.http.get<LocationsResponse>(`${this.config.apiBaseUrl()}/inventory/locations`, {
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
}
