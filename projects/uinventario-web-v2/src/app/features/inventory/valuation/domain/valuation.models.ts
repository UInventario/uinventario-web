export type ValuationMethod = 'MOVING_AVERAGE' | 'FIFO' | 'SPECIFIC_LOT';

export interface ValuationPolicy {
  readonly method: ValuationMethod;
  readonly version: number;
  readonly effectiveAt: string;
  readonly migrationRule: 'INITIAL_DEFAULT' | 'FORWARD_ONLY_CUTOVER';
}

export interface ValuationMigrationPlan {
  readonly current: ValuationPolicy;
  readonly targetMethod: ValuationMethod;
  readonly allowed: boolean;
  readonly blockingReasons: readonly string[];
  readonly strategy:
    | 'USE_MAINTAINED_MOVING_AVERAGE'
    | 'USE_MAINTAINED_FIFO_LAYERS'
    | 'OPENING_LOTS_AT_MOVING_AVERAGE';
  readonly productsToMigrate: number;
  readonly locationsToMigrate: number;
  readonly devicesToRebootstrap: number;
  readonly planFingerprint: string;
}

export interface ValuationStockItem {
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly sku: string;
    readonly active: boolean;
    readonly trackLots: boolean;
    readonly baseUnit: string;
    readonly quantityPrecision: number;
  };
  readonly availableQuantity: string;
  readonly totalQuantity: string;
  readonly averageUnitCost: string;
  readonly inventoryValue: string;
  readonly costing: {
    readonly method: ValuationMethod;
    readonly currency: string;
    readonly quantity: string;
    readonly inventoryValue: string;
    readonly reconciled: boolean;
  };
  readonly valuation: {
    readonly quantity: string;
    readonly inventoryValue: string;
    readonly quantityReconciled: boolean;
    readonly valueReconciled: boolean;
    readonly reconciled: boolean;
  };
  readonly lotTracking: {
    readonly lotQuantity: string;
    readonly reconciled: boolean;
    readonly currency: string | null;
    readonly inventoryValue: string;
  } | null;
  readonly fifoValuation: {
    readonly quantity: string;
    readonly inventoryValue: string;
    readonly currency: string | null;
    readonly reconciled: boolean;
  };
}

export interface ValuationStockPage {
  readonly items: readonly ValuationStockItem[];
  readonly scope: {
    readonly branch: { readonly id: string; readonly name: string };
    readonly warehouse: { readonly id: string; readonly name: string };
  };
  readonly valuation: {
    readonly method: ValuationMethod;
    readonly policyVersion: number;
    readonly effectiveAt: string;
    readonly currency: string;
    readonly asOf: string;
  };
  readonly pagination: Pagination;
}

export interface FifoLayer {
  readonly id: string;
  readonly product: { readonly id: string; readonly name: string; readonly sku: string };
  readonly location: { readonly id: string; readonly name: string; readonly code: string };
  readonly originType: 'MIGRATION_CUT' | 'ENTRY' | 'PURCHASE_RECEIPT' | 'RETURN' | 'TRANSFER';
  readonly originalQuantity: string;
  readonly remainingQuantity: string;
  readonly unitCost: string;
  readonly currency: string;
  readonly inventoryValue: string;
  readonly acquiredAt: string;
  readonly source: {
    readonly movementId: string | null;
    readonly movementType: string | null;
    readonly reference: string | null;
    readonly layerId: string | null;
    readonly purchaseReceiptLineId: string | null;
  };
}

export interface FifoLayerSet {
  readonly items: readonly FifoLayer[];
  readonly meta: {
    readonly method: 'FIFO';
    readonly cutover: {
      readonly effectiveAt: string;
      readonly migrationRule: 'OPENING_BALANCE_AT_MOVING_AVERAGE';
    };
    readonly totalQuantity: string;
    readonly layerQuantity: string;
    readonly reconciled: boolean;
    readonly currency: string | null;
    readonly inventoryValue: string;
  };
}

export interface ValuedMovement {
  readonly id: string;
  readonly type: string;
  readonly direction: 'IN' | 'OUT' | 'TRANSFER';
  readonly quantityChange: string;
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
  readonly valuation: {
    readonly method: ValuationMethod;
    readonly policyVersion: number;
    readonly effectiveAt: string;
    readonly unitCost: string;
    readonly valueChange: string;
    readonly resultingInventoryValue: string | null;
    readonly averageUnitCost: string | null;
  } | null;
}

export interface ValuedMovementPage {
  readonly items: readonly ValuedMovement[];
  readonly pagination: Pagination;
}

export interface ReconciliationFinding {
  readonly id: string;
  readonly code: string;
  readonly severity: 'WARNING' | 'CRITICAL';
  readonly scopeType: 'TENANT' | 'PRODUCT' | 'LOCATION' | 'LOT' | 'SERIAL' | 'VALUATION';
  readonly product: { readonly id: string; readonly name: string; readonly sku: string } | null;
  readonly location: { readonly id: string; readonly name: string; readonly code: string } | null;
  readonly subjectReference: string | null;
  readonly expectedValue: string | null;
  readonly actualValue: string | null;
  readonly differenceValue: string | null;
  readonly message: string;
  readonly recommendedAction: string;
  readonly blocksOperations: boolean;
}

export interface ReconciliationRun {
  readonly id: string;
  readonly status: 'RUNNING' | 'COMPLETED';
  readonly overallStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  readonly summary: {
    readonly findings: number;
    readonly warnings: number;
    readonly critical: number;
  };
  readonly policy: { readonly releaseBlocked: boolean; readonly operationsBlocked: boolean };
  readonly correlationId: string;
  readonly responsible: { readonly id: string; readonly email: string };
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly findings: readonly ReconciliationFinding[];
}

export interface Pagination {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface ValuationStockQuery {
  readonly q?: string;
  readonly page: number;
  readonly pageSize: number;
}
