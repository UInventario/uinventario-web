export type InventoryStockState = 'AVAILABLE' | 'RESERVED' | 'DAMAGED' | 'IN_TRANSIT';

export type UserInventoryMovementType =
  'INITIAL' | 'ENTRY' | 'EXIT' | 'RETURN' | 'LOSS' | 'DAMAGE' | 'ADJUSTMENT';

export type InventoryMovementType =
  | UserInventoryMovementType
  | 'IMPORT'
  | 'STATE_TRANSITION'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'TRANSFER_RECEIPT'
  | 'TRANSFER_DISCREPANCY'
  | 'SALE'
  | 'SALE_VOID'
  | 'SALE_RETURN'
  | 'PURCHASE_RECEIPT'
  | 'SUPPLIER_RETURN';

export interface InventoryStockItem {
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly sku: string;
    readonly active: boolean;
    readonly trackLots: boolean;
    readonly baseUnit: string;
    readonly quantityPrecision: number;
    readonly minimumQuantity: string;
  };
  readonly availableQuantity: string;
  readonly totalQuantity: string;
  readonly states: readonly { readonly code: InventoryStockState; readonly quantity: string }[];
  readonly averageUnitCost: string;
  readonly inventoryValue: string;
  readonly costing: {
    readonly method: string;
    readonly currency: string;
    readonly reconciled: boolean;
  };
}

export interface InventoryStockPage {
  readonly items: readonly InventoryStockItem[];
  readonly scope: {
    readonly branch: { readonly id: string; readonly name: string };
    readonly warehouse: { readonly id: string; readonly name: string };
  };
  readonly currency: string;
  readonly pagination: Pagination;
}

export interface InventoryMovement {
  readonly id: string;
  readonly type: InventoryMovementType;
  readonly direction: 'IN' | 'OUT' | 'TRANSFER';
  readonly quantityChange: string;
  readonly previousQuantity: string;
  readonly resultingQuantity: string;
  readonly reason: string;
  readonly reference: string | null;
  readonly createdAt: string;
  readonly product: { readonly id: string; readonly name: string; readonly sku: string };
  readonly location: {
    readonly id: string;
    readonly name: string;
    readonly code: string;
    readonly warehouse: { readonly id: string; readonly name: string };
  };
  readonly responsible: { readonly id: string; readonly email: string };
  readonly stateTransition: {
    readonly from: InventoryStockState;
    readonly to: InventoryStockState;
    readonly quantity: string;
  } | null;
  readonly pendingSync?: boolean;
}

export interface InventoryMovementPage {
  readonly items: readonly InventoryMovement[];
  readonly branch: { readonly id: string; readonly name: string };
  readonly pagination: Pagination;
}

export interface Pagination {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface InventoryLocation {
  readonly id: string;
  readonly name: string;
  readonly code: string;
}

export interface InventoryProductDetails {
  readonly id: string;
  readonly name: string;
  readonly sku: string;
  readonly active: boolean;
  readonly trackLots: boolean;
  readonly trackSerials: boolean;
  readonly baseUnit: string;
  readonly quantityPrecision: number;
}

export interface StockQuery {
  readonly q?: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface MovementQuery {
  readonly q?: string;
  readonly type?: InventoryMovementType;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface InventoryMovementInput {
  readonly productId: string;
  readonly locationId: string;
  readonly type: UserInventoryMovementType;
  readonly quantity: string;
  readonly reason: string;
  readonly reference: string;
  readonly lotCode?: string;
  readonly manufacturedOn?: string;
  readonly expiresOn?: string;
  readonly serialNumbers?: readonly string[];
}

export interface InventoryStateTransitionInput {
  readonly productId: string;
  readonly locationId: string;
  readonly fromState: InventoryStockState;
  readonly toState: InventoryStockState;
  readonly quantity: string;
  readonly reason: string;
  readonly reference: string;
  readonly serialNumbers?: readonly string[];
}
