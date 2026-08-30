export interface ReportPagination {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface ReportQuery {
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly branchId?: string;
  readonly cashRegisterId?: string;
  readonly userId?: string;
  readonly warehouseId?: string;
  readonly categoryId?: string;
  readonly product?: string;
  readonly status?: 'ALL' | 'COMPLETED' | 'VOIDED';
  readonly page: number;
  readonly pageSize: number;
}

export interface BranchOption {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
}

export interface SalesCashReport {
  readonly scope: readonly BranchOption[];
  readonly options: {
    readonly branches: readonly BranchOption[];
    readonly registers: readonly {
      id: string;
      name: string;
      code: string;
      branch_id: string;
    }[];
    readonly users: readonly { id: string; email: string }[];
  };
  readonly summary: {
    readonly sales: {
      readonly total: number;
      readonly completed: number;
      readonly voided: number;
      readonly net: string;
      readonly voidedAmount: string;
    };
    readonly payments: readonly {
      readonly method: string;
      readonly status: string;
      readonly count: number;
      readonly amount: string;
    }[];
    readonly cash: {
      readonly shifts: number;
      readonly open: number;
      readonly closed: number;
      readonly expected: string;
      readonly counted: string;
      readonly difference: string;
    };
    readonly reconciliation: {
      readonly salesNet: string;
      readonly paymentsApplied: string;
      readonly matches: boolean;
    };
  };
  readonly sales: readonly SaleReportRow[];
  readonly shifts: readonly CashShiftReportRow[];
  readonly total: number;
}

export interface SaleReportRow {
  readonly id: string;
  readonly receiptNumber: string;
  readonly status: 'COMPLETED' | 'VOIDED';
  readonly branch: { readonly id: string; readonly name: string };
  readonly cashRegister: { readonly id: string; readonly name: string; readonly code: string };
  readonly user: { readonly id: string; readonly email: string };
  readonly currency: string;
  readonly total: string;
  readonly payments: readonly {
    readonly method: string;
    readonly status: string;
    readonly amount: string;
    readonly change: string;
    readonly reference: string | null;
  }[];
  readonly createdAt: string;
  readonly voidedAt: string | null;
}

export interface CashShiftReportRow {
  readonly id: string;
  readonly status: 'OPEN' | 'CLOSED';
  readonly branch: { readonly id: string; readonly name: string };
  readonly cashRegister: { readonly id: string; readonly name: string; readonly code: string };
  readonly openedByEmail: string;
  readonly currency: string;
  readonly opening: string;
  readonly expected: string;
  readonly counted: string | null;
  readonly difference: string | null;
  readonly openedAt: string;
  readonly closedAt: string | null;
}

export interface ProfitabilityReport {
  readonly scope: readonly BranchOption[];
  readonly formulas: Readonly<Record<string, string>>;
  readonly currencies: readonly ProfitCurrency[];
  readonly products: readonly ProfitProduct[];
  readonly activities: readonly ProfitActivity[];
  readonly total: number;
}

export interface ProfitCurrency {
  readonly currency: string;
  readonly sales: number;
  readonly returns: number;
  readonly cancellations: number;
  readonly grossRevenue: string;
  readonly discounts: string;
  readonly salesTotal: string;
  readonly returnTotal: string;
  readonly netTotal: string;
  readonly netRevenue: string;
  readonly taxes: string;
  readonly historicalCost: string;
  readonly returnedCost: string;
  readonly netCost: string;
  readonly margin: string;
  readonly marginRate: number | null;
  readonly paymentObligations: string;
  readonly creditSales: string;
  readonly refundsSettled: string;
  readonly voidedAmount: string;
  readonly salesMatchPayments: boolean;
}

export interface ProfitProduct {
  readonly product: { readonly id: string; readonly name: string; readonly sku: string };
  readonly currency: string;
  readonly soldQuantity: string;
  readonly returnedQuantity: string;
  readonly grossRevenue: string;
  readonly discounts: string;
  readonly netRevenue: string;
  readonly taxes: string;
  readonly netCost: string;
  readonly margin: string;
}

export interface ProfitActivity {
  readonly id: string;
  readonly type: 'SALE' | 'RETURN' | 'VOID';
  readonly saleId: string;
  readonly receiptNumber: string;
  readonly branchName: string;
  readonly cashRegisterName: string;
  readonly currency: string;
  readonly netRevenue: string;
  readonly taxes: string;
  readonly historicalCost: string;
  readonly marginImpact: string;
  readonly paymentOrSettlement: string;
  readonly reconciles: boolean;
  readonly occurredAt: string;
}

export interface InventoryActivityReport {
  readonly period: {
    readonly dateFrom: string | null;
    readonly dateTo: string | null;
    readonly timezone: 'BRANCH_LOCAL';
  };
  readonly scope: {
    readonly branches: readonly BranchOption[];
    readonly warehouses: readonly {
      readonly id: string;
      readonly name: string;
      readonly branch: { readonly id: string; readonly name: string };
    }[];
  };
  readonly filters: {
    readonly categories: readonly { readonly id: string; readonly name: string }[];
  };
  readonly definitions: Readonly<Record<string, string>>;
  readonly items: readonly InventoryActivityRow[];
  readonly total: number;
}

export interface InventoryActivityRow {
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly sku: string;
    readonly category: { readonly id: string; readonly name: string } | null;
  };
  readonly openingQuantity: string;
  readonly closingQuantity: string;
  readonly averageQuantity: string;
  readonly netSoldQuantity: string;
  readonly lossQuantity: string;
  readonly activityQuantity: string;
  readonly rotation: number | null;
  readonly status: 'SLOW' | 'ACTIVE';
  readonly lastMovementAt: string | null;
}

export interface InventoryMovementRow {
  readonly id: string;
  readonly type: string;
  readonly quantityChange: string;
  readonly resultingQuantity: string;
  readonly reason: string;
  readonly reference: string | null;
  readonly occurredAt: string;
  readonly branchName: string;
  readonly warehouseName: string;
  readonly locationName: string;
}

export interface SaleDetail {
  readonly id: string;
  readonly receiptNumber: string;
  readonly status: 'COMPLETED' | 'VOIDED';
  readonly context: {
    readonly branch: { readonly id: string; readonly name: string };
    readonly warehouse: { readonly id: string; readonly name: string };
    readonly cashRegister: { readonly id: string; readonly name: string; readonly code: string };
  };
  readonly user: { readonly id: string; readonly email: string };
  readonly customer: {
    readonly id: string;
    readonly name: string;
    readonly identifier: string | null;
  } | null;
  readonly currency: string;
  readonly lines: readonly SaleDetailLine[];
  readonly totals: {
    readonly gross: string;
    readonly discount: string;
    readonly subtotal: string;
    readonly tax: string;
    readonly total: string;
    readonly grossProfit: string | null;
  };
  readonly payments: readonly {
    readonly id: string;
    readonly method: string;
    readonly status: string;
    readonly amountReceived: string;
    readonly amountApplied: string;
    readonly change: string;
    readonly reference: string | null;
    readonly provider: string;
    readonly authorizationCode: string | null;
  }[];
  readonly movements: readonly InventoryMovementLink[];
  readonly createdAt: string;
  readonly void: { readonly reason: string; readonly voidedAt: string } | null;
}

export interface SaleDetailLine {
  readonly id: string;
  readonly product: { readonly id: string; readonly name: string; readonly sku: string };
  readonly quantity: string;
  readonly unitPrice: string;
  readonly subtotal: string;
  readonly tax: string;
  readonly total: string;
}

export interface InventoryMovementLink {
  readonly id: string;
  readonly type: string;
  readonly product: { readonly id: string; readonly name: string; readonly sku: string };
  readonly location: { readonly id: string; readonly name: string; readonly code: string };
  readonly quantityChange: string;
  readonly resultingQuantity: string;
  readonly reference: string;
  readonly createdAt: string;
}

export interface SaleReturn {
  readonly id: string;
  readonly reason: string;
  readonly settlementStatus: string;
  readonly refundableAmount: string;
  readonly totals: { readonly subtotal: string; readonly tax: string; readonly total: string };
  readonly returnedBy: { readonly id: string; readonly email: string };
  readonly createdAt: string;
  readonly lines: readonly {
    readonly id: string;
    readonly product: { readonly id: string; readonly name: string; readonly sku: string };
    readonly quantity: string;
    readonly condition: 'SELLABLE' | 'DAMAGED';
    readonly totals: { readonly subtotal: string; readonly tax: string; readonly total: string };
  }[];
}
