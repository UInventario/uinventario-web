export type PurchaseOrderStatus =
  'DRAFT' | 'APPROVED' | 'SENT' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface Pagination {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface PurchaseOrderLine {
  readonly id: string;
  readonly supplierProductId: string;
  readonly productId: string;
  readonly productName: string;
  readonly productSku: string;
  readonly baseUnit: string;
  readonly quantityPrecision: number;
  readonly minimumQuantity: string;
  readonly supplierCode: string;
  readonly quantity: string;
  readonly receivedQuantity: string;
  readonly remainingQuantity: string;
  readonly overageQuantity: string;
  readonly unitCost: string;
  readonly subtotal: string;
  readonly notes: string | null;
}

export interface PurchaseReceiptLine {
  readonly id: string;
  readonly purchaseOrderLineId: string;
  readonly receivedQuantity: string;
  readonly lotCode: string | null;
  readonly manufacturedOn: string | null;
  readonly expiresOn: string | null;
  readonly overageQuantity: string;
  readonly unitCost: string;
  readonly totalCost: string;
  readonly previousCatalogCost: string;
  readonly resultingCatalogCost: string;
  readonly returnedQuantity: string;
  readonly returnableQuantity: string;
}

export interface PurchaseReceipt {
  readonly id: string;
  readonly documentReference: string;
  readonly location: { readonly id: string; readonly name: string; readonly code: string };
  readonly responsible: { readonly id: string; readonly email: string };
  readonly overageReason: string | null;
  readonly lines: readonly PurchaseReceiptLine[];
  readonly createdAt: string;
}

export interface PurchaseReturn {
  readonly id: string;
  readonly purchaseReceiptId: string;
  readonly documentReference: string;
  readonly reason: string;
  readonly status: 'CREDIT_PENDING' | 'CREDIT_RECEIVED';
  readonly expectedCreditTotal: string;
  readonly creditDocumentReference: string | null;
  readonly location: { readonly id: string; readonly name: string; readonly code: string };
  readonly responsible: { readonly id: string; readonly email: string };
  readonly lines: readonly {
    readonly id: string;
    readonly purchaseReceiptLineId: string;
    readonly productId: string;
    readonly returnedQuantity: string;
    readonly unitCost: string;
    readonly totalCost: string;
  }[];
  readonly createdAt: string;
}

export interface PurchaseOrderTransition {
  readonly id: string;
  readonly fromStatus: PurchaseOrderStatus;
  readonly toStatus: PurchaseOrderStatus;
  readonly reason: string | null;
  readonly delivery: { readonly mode: 'SIMULATED'; readonly recipient: string | null } | null;
  readonly createdAt: string;
}

export interface PurchaseOrder {
  readonly id: string;
  readonly folio: string;
  readonly supplier: { readonly id: string; readonly name: string };
  readonly currency: string;
  readonly status: PurchaseOrderStatus;
  readonly notes: string | null;
  readonly subtotal: string;
  readonly total: string;
  readonly version: number;
  readonly approvedAt: string | null;
  readonly sentAt: string | null;
  readonly cancelledAt: string | null;
  readonly cancellationReason: string | null;
  readonly transitions: readonly PurchaseOrderTransition[];
  readonly receipts: readonly PurchaseReceipt[];
  readonly returns: readonly PurchaseReturn[];
  readonly lines: readonly PurchaseOrderLine[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PurchaseOrderPage {
  readonly orders: readonly PurchaseOrder[];
  readonly pagination: Pagination;
}

export interface PurchaseOrderQuery {
  readonly q?: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface PurchaseOrderInput {
  readonly supplierId: string;
  readonly currency: string;
  readonly notes?: string;
  readonly lines: readonly {
    readonly supplierProductId: string;
    readonly quantity: string;
    readonly unitCost: string;
    readonly notes?: string;
  }[];
}

export interface PurchaseReceiptInput {
  readonly version: number;
  readonly locationId: string;
  readonly documentReference: string;
  readonly overageReason?: string;
  readonly lines: readonly {
    readonly purchaseOrderLineId: string;
    readonly receivedQuantity: string;
    readonly lotCode?: string;
    readonly manufacturedOn?: string;
    readonly expiresOn?: string;
    readonly serialNumbers?: readonly string[];
  }[];
}

export interface PurchaseReturnInput {
  readonly purchaseReceiptId: string;
  readonly documentReference: string;
  readonly reason: string;
  readonly lines: readonly {
    readonly purchaseReceiptLineId: string;
    readonly returnedQuantity: string;
    readonly serialNumbers?: readonly string[];
  }[];
}

export interface SupplierOption {
  readonly id: string;
  readonly legalName: string;
  readonly tradeName: string | null;
}

export interface SupplierProductOption {
  readonly id: string;
  readonly supplierCode: string;
  readonly minimumQuantity: string | null;
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly sku: string;
    readonly quantityPrecision: number;
  };
  readonly prices: readonly {
    readonly currency: string;
    readonly unitCost: string;
    readonly validFrom: string;
  }[];
}

export interface ReceiptLocation {
  readonly id: string;
  readonly name: string;
  readonly code: string;
}

export type PurchaseTransitionAction = 'APPROVE' | 'SEND' | 'CANCEL';
