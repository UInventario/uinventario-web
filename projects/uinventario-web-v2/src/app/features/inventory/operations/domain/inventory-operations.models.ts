export type CountStatus = 'OPEN' | 'CLOSED';
export type AlertStatus = 'LOW' | 'OUT_OF_STOCK' | 'RECOVERED';
export type ImportMode = 'INITIAL' | 'COUNT';

export interface CountAttempt {
  readonly attempt: number;
  readonly countedQuantity: string;
  readonly responsible: { readonly id: string; readonly email: string };
  readonly createdAt: string;
}

export interface CountLine {
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly sku: string;
    readonly baseUnit: string;
    readonly quantityPrecision: number;
    readonly minimumQuantity: string;
  };
  readonly snapshotQuantity: string | null;
  readonly countedQuantity: string | null;
  readonly varianceQuantity: string | null;
  readonly attemptCount: number;
  readonly countedBy: { readonly id: string; readonly email: string } | null;
  readonly countedAt: string | null;
  readonly movementId: string | null;
  readonly attempts: readonly CountAttempt[];
}

export interface CountSession {
  readonly id: string;
  readonly status: CountStatus;
  readonly blind: boolean;
  readonly branch: { readonly id: string; readonly name: string };
  readonly warehouse: { readonly id: string; readonly name: string };
  readonly location: { readonly id: string; readonly name: string; readonly code: string };
  readonly createdBy: { readonly id: string; readonly email: string };
  readonly closedBy: { readonly id: string; readonly email: string } | null;
  readonly createdAt: string;
  readonly closedAt: string | null;
  readonly lines: readonly CountLine[];
}

export interface LocationOption {
  readonly id: string;
  readonly name: string;
  readonly code: string;
}

export interface ProductOption {
  readonly id: string;
  readonly name: string;
  readonly sku: string;
  readonly quantity: string;
}

export interface CountSessionInput {
  readonly locationId: string;
  readonly productIds: readonly string[];
  readonly blind: boolean;
}

export interface ImportRow {
  readonly id: string;
  readonly rowNumber: number;
  readonly product: { readonly id: string; readonly name: string; readonly sku: string } | null;
  readonly location: { readonly id: string; readonly name: string; readonly code: string } | null;
  readonly state: string | null;
  readonly targetQuantity: string | null;
  readonly currentQuantity: string | null;
  readonly difference: string | null;
  readonly reason: string;
  readonly errors: readonly { readonly code: string; readonly message: string }[];
}

export interface InventoryImport {
  readonly id: string;
  readonly mode: ImportMode;
  readonly status: 'PREVIEWED' | 'CONFIRMED';
  readonly sourceFilename: string;
  readonly policy: 'ATOMIC';
  readonly canConfirm: boolean;
  readonly summary: {
    readonly rows: number;
    readonly validRows: number;
    readonly errorRows: number;
    readonly movements: number | null;
  };
  readonly rows: readonly ImportRow[];
  readonly confirmedAt: string | null;
}

export interface StockAlert {
  readonly product: { readonly id: string; readonly name: string; readonly sku: string };
  readonly location: { readonly id: string; readonly name: string; readonly code: string };
  readonly status: AlertStatus;
  readonly availableQuantity: string;
  readonly threshold: string;
  readonly transitionedAt: string;
}

export interface AlertPage {
  readonly items: readonly StockAlert[];
  readonly defaultThreshold: string;
  readonly scope: {
    readonly branch: { readonly id: string; readonly name: string };
    readonly warehouse: { readonly id: string; readonly name: string };
  };
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

export interface AlertQuery {
  readonly q?: string;
  readonly status?: AlertStatus;
  readonly page: number;
  readonly pageSize: number;
}
