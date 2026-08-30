export type SalePaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'VOUCHER' | 'CREDIT';

export interface SaleSummary {
  readonly id: string;
  readonly receiptNumber: string;
  readonly status: 'COMPLETED' | 'VOIDED';
  readonly user: { readonly id: string; readonly email: string };
  readonly customer: {
    readonly id: string;
    readonly name: string;
    readonly identifier: string | null;
  } | null;
  readonly cashRegister: { readonly id: string; readonly name: string; readonly code: string };
  readonly currency: string;
  readonly total: string;
  readonly paymentMethod: SalePaymentMethod | 'MIXED';
  readonly createdAt: string;
}

export interface SalePage {
  readonly items: readonly SaleSummary[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

export interface SalePayment {
  readonly id: string;
  readonly method: SalePaymentMethod;
  readonly status: 'COMPLETED' | 'PENDING' | 'REVERSED';
  readonly amountReceived: string;
  readonly amountApplied: string;
  readonly change: string;
  readonly reference: string | null;
  readonly provider: string;
  readonly authorizationCode: string | null;
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
  readonly lines: readonly SaleLine[];
  readonly totals: {
    readonly gross: string;
    readonly discount: string;
    readonly subtotal: string;
    readonly tax: string;
    readonly total: string;
    readonly grossProfit: string | null;
  };
  readonly payments: readonly SalePayment[];
  readonly movements: readonly {
    readonly id: string;
    readonly type: 'SALE' | 'SALE_VOID' | 'SALE_RETURN';
    readonly saleLineId: string;
    readonly product: { readonly id: string; readonly name: string; readonly sku: string };
    readonly location: { readonly id: string; readonly name: string; readonly code: string };
    readonly quantityChange: string;
    readonly resultingQuantity: string;
    readonly reference: string;
    readonly createdAt: string;
  }[];
  readonly createdAt: string;
  readonly void: {
    readonly reason: string;
    readonly user: { readonly id: string; readonly email: string };
    readonly voidedAt: string;
  } | null;
}

export interface SaleLine {
  readonly id: string;
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly sku: string;
    readonly stockBehavior?: 'TRACKED' | 'UNTRACKED';
  };
  readonly quantity: string;
  readonly note: string | null;
  readonly unitPrice: string;
  readonly subtotal: string;
  readonly tax: string;
  readonly total: string;
}

export interface SaleReturn {
  readonly id: string;
  readonly saleId: string;
  readonly exchangeSale: { readonly id: string; readonly receiptNumber: string } | null;
  readonly reason: string;
  readonly settlementStatus: 'PENDING' | 'PARTIALLY_SETTLED' | 'SETTLED';
  readonly refundableAmount: string;
  readonly loyaltyValueRestored: string;
  readonly totals: { readonly subtotal: string; readonly tax: string; readonly total: string };
  readonly returnedBy: { readonly id: string; readonly email: string };
  readonly createdAt: string;
  readonly settlements: readonly SaleReturnSettlement[];
  readonly lines: readonly {
    readonly id: string;
    readonly saleLineId: string;
    readonly product: { readonly id: string; readonly name: string; readonly sku: string };
    readonly quantity: string;
    readonly condition: 'SELLABLE' | 'DAMAGED';
    readonly totals: { readonly subtotal: string; readonly tax: string; readonly total: string };
    readonly serialNumbers: readonly string[];
  }[];
}

export interface SaleReturnSettlement {
  readonly id: string;
  readonly mode: 'REFUND' | 'STORE_CREDIT';
  readonly method: 'CASH' | 'CARD' | 'TRANSFER' | 'VOUCHER' | 'STORE_CREDIT';
  readonly status: 'COMPLETED' | 'FAILED';
  readonly currency: string;
  readonly amount: string;
  readonly originalPayment: {
    readonly id: string;
    readonly method: 'CASH' | 'CARD' | 'TRANSFER' | 'VOUCHER';
  } | null;
  readonly provider: string;
  readonly providerReference: string | null;
  readonly failureCode: string | null;
  readonly processedBy: { readonly id: string; readonly email: string };
  readonly createdAt: string;
}

export interface CreateSaleReturnInput {
  readonly reason: string;
  readonly exchangeSaleId?: string;
  readonly lines: readonly {
    readonly saleLineId: string;
    readonly quantity: string;
    readonly condition: 'SELLABLE' | 'DAMAGED';
    readonly serialNumbers?: readonly string[];
  }[];
}

export interface SettleSaleReturnInput {
  readonly mode: 'REFUND' | 'STORE_CREDIT';
  readonly amount: string;
  readonly originalPaymentId?: string;
}

export interface SaleReceipt {
  readonly saleId: string;
  readonly receiptNumber: string;
  readonly documentType: 'NON_FISCAL_SALE_RECEIPT';
  readonly fiscalNotice: 'COMPROBANTE NO FISCAL';
  readonly merchant: {
    readonly name: string;
    readonly legalName: string | null;
    readonly countryCode: string | null;
  };
  readonly branchName: string;
  readonly cashRegister: { readonly name: string; readonly code: string };
  readonly sellerEmail: string;
  readonly customer: { readonly name: string; readonly identifier: string | null } | null;
  readonly currency: string;
  readonly taxRate: string;
  readonly lines: readonly {
    readonly lineNumber: number;
    readonly productName: string;
    readonly productSku: string;
    readonly quantity: string;
    readonly unitPrice: string;
    readonly discountTotal: string;
    readonly total: string;
  }[];
  readonly payments: readonly {
    readonly method: SalePaymentMethod;
    readonly amountReceived: string;
    readonly amountApplied: string;
    readonly change: string;
    readonly reference: string | null;
    readonly provider: string;
    readonly authorizationCode: string | null;
  }[];
  readonly totals: {
    readonly gross: string;
    readonly discount: string;
    readonly subtotal: string;
    readonly tax: string;
    readonly total: string;
  };
  readonly issuedAt: string;
  readonly saleStatus: 'COMPLETED' | 'VOIDED';
  readonly void: { readonly reason: string; readonly voidedAt: string } | null;
}

export interface ReceiptDelivery {
  readonly mode: 'SIMULATED' | 'PROVIDER';
  readonly channel: 'EMAIL';
  readonly recipient: string;
  readonly messageId: string;
  readonly acceptedAt: string;
}

export type FiscalDocumentType = 'INVOICE' | 'RECEIPT' | 'CREDIT_NOTE' | 'PAYMENT_RECEIPT';
export type FiscalDocumentStatus =
  'PENDING' | 'ACCEPTED' | 'REJECTED' | 'INDETERMINATE' | 'CANCELLED';

export interface SaleFiscalDocument {
  readonly id: string;
  readonly saleId: string;
  readonly receiptNumber: string;
  readonly documentType: FiscalDocumentType;
  readonly provider: 'SIMULATOR';
  readonly providerVersion: '1';
  readonly providerReference: string | null;
  readonly scenario: 'SUCCESS' | 'REJECT' | 'TIMEOUT';
  readonly status: FiscalDocumentStatus;
  readonly errorCode: string | null;
  readonly artifacts: readonly { readonly kind: 'PDF' | 'XML'; readonly path: string }[];
  readonly events: readonly {
    readonly status: FiscalDocumentStatus | 'SENT';
    readonly occurredAt: string;
  }[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface FiscalArtifactFile {
  readonly mediaType: string;
  readonly fileName: string;
  readonly contentBase64: string;
}

export interface SuspendedSale {
  readonly id: string;
  readonly status: 'ACTIVE' | 'CANCELLED' | 'RESUMED' | 'EXPIRED';
  readonly context: {
    readonly branch: { readonly id: string; readonly name: string };
    readonly warehouse: { readonly id: string; readonly name: string };
    readonly cashRegister: { readonly id: string; readonly name: string; readonly code: string };
  };
  readonly author: { readonly id: string; readonly email: string };
  readonly customer: {
    readonly id: string;
    readonly name: string;
    readonly identifier: string | null;
  } | null;
  readonly notes: string | null;
  readonly lines: readonly {
    readonly product: { readonly id: string; readonly name: string; readonly sku: string };
    readonly quantity: string;
    readonly lotId: string | null;
    readonly serialNumbers: readonly string[];
    readonly unitPriceSnapshot: string;
    readonly availableQuantitySnapshot: string;
  }[];
  readonly completedSaleId: string | null;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly cancelledAt: string | null;
  readonly resumedAt: string | null;
}

export interface SuspendedSaleResume {
  readonly suspendedSale: SuspendedSale;
  readonly quote: {
    readonly currency: string;
    readonly lines: readonly {
      readonly product: {
        readonly id: string;
        readonly name: string;
        readonly sku: string;
        readonly withoutCode: boolean;
        readonly stockBehavior: 'TRACKED' | 'UNTRACKED';
        readonly taxBehavior: 'STANDARD' | 'EXEMPT';
        readonly baseUnit:
          'UNIT' | 'KILOGRAM' | 'GRAM' | 'LITER' | 'MILLILITER' | 'METER' | 'CENTIMETER';
        readonly quantityPrecision: number;
        readonly minimumQuantity: string;
      };
      readonly quantity: string;
      readonly unitPrice: string;
      readonly availableQuantity: string;
    }[];
  } | null;
  readonly conflicts: readonly {
    readonly code:
      'PRICE_CHANGED' | 'AVAILABILITY_CHANGED' | 'INSUFFICIENT_STOCK' | 'PRODUCT_NOT_AVAILABLE';
    readonly productId: string;
    readonly previous?: string;
    readonly current?: string;
  }[];
}
