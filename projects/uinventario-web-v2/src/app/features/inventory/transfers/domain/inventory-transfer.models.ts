export type InventoryTransferStatus =
  'DRAFT' | 'DISPATCHED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface TransferLocation {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly active: boolean;
}

export interface TransferWarehouse {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly locations: readonly TransferLocation[];
}

export interface TransferBranch {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly warehouses: readonly TransferWarehouse[];
}

export interface TransferProduct {
  readonly id: string;
  readonly name: string;
  readonly sku: string;
  readonly quantity: string;
}

export interface InventoryTransferLine {
  readonly id: string;
  readonly lineNumber: number;
  readonly product: { readonly id: string; readonly name: string; readonly sku: string };
  readonly sourceLocation: { readonly id: string; readonly name: string; readonly code: string };
  readonly destinationLocation: {
    readonly id: string;
    readonly name: string;
    readonly code: string;
  };
  readonly quantity: string;
  readonly receivedQuantity: string;
  readonly discrepancyQuantity: string;
  readonly pendingQuantity: string;
  readonly serialNumbers: readonly string[];
}

export interface InventoryTransferReceipt {
  readonly id: string;
  readonly discrepancyReason: string | null;
  readonly receivedBy: { readonly id: string; readonly email: string };
  readonly createdAt: string;
  readonly lines: readonly {
    readonly id: string;
    readonly lineNumber: number;
    readonly transferLineId: string;
    readonly product: { readonly id: string; readonly name: string; readonly sku: string };
    readonly receivedQuantity: string;
    readonly discrepancyQuantity: string;
  }[];
}

export interface InventoryTransfer {
  readonly id: string;
  readonly status: InventoryTransferStatus;
  readonly reference: string;
  readonly reason: string;
  readonly originWarehouse: {
    readonly id: string;
    readonly name: string;
    readonly branch: { readonly id: string; readonly name: string };
  };
  readonly destinationWarehouse: {
    readonly id: string;
    readonly name: string;
    readonly branch: { readonly id: string; readonly name: string };
  };
  readonly lines: readonly InventoryTransferLine[];
  readonly receipts: readonly InventoryTransferReceipt[];
  readonly createdBy: { readonly id: string; readonly email: string };
  readonly dispatchedBy: { readonly id: string; readonly email: string } | null;
  readonly cancelledBy: { readonly id: string; readonly email: string } | null;
  readonly createdAt: string;
  readonly dispatchedAt: string | null;
  readonly cancelledAt: string | null;
}

export interface CreateInventoryTransferInput {
  readonly destinationWarehouseId: string;
  readonly reference: string;
  readonly reason: string;
  readonly lines: readonly {
    readonly productId: string;
    readonly sourceLocationId: string;
    readonly destinationLocationId: string;
    readonly quantity: string;
    readonly serialNumbers?: readonly string[];
  }[];
}

export interface ReceiveInventoryTransferInput {
  readonly discrepancyReason?: string;
  readonly lines: readonly {
    readonly transferLineId: string;
    readonly receivedQuantity: string;
    readonly discrepancyQuantity: string;
    readonly receivedSerialNumbers?: readonly string[];
    readonly discrepancySerialNumbers?: readonly string[];
  }[];
}
