export interface Pagination {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export type SalesChannel = 'POS' | 'WEB' | 'MOBILE' | 'DESKTOP';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'VOUCHER';

export interface CustomerOption {
  readonly id: string;
  readonly name: string;
  readonly identifier: string | null;
}

export interface ProductOption {
  readonly id: string;
  readonly name: string;
  readonly sku: string;
  readonly availableQuantity: string;
  readonly minimumQuantity: string;
  readonly quantityPrecision: number;
}

export interface LocationOption {
  readonly id: string;
  readonly name: string;
  readonly code: string;
}

export interface OperationLineInput {
  readonly productId: string;
  readonly quantity: string;
  readonly serialNumbers?: readonly string[];
}

export interface PaymentInput {
  readonly method: PaymentMethod;
  readonly amount?: string;
  readonly amountReceived?: string;
  readonly reference?: string;
}

export interface CartQuote {
  readonly currency: string;
  readonly lines: readonly {
    readonly product: { readonly id: string; readonly name: string; readonly sku: string };
    readonly quantity: string;
    readonly availableQuantity: string;
    readonly unitPrice: string;
    readonly total: string;
  }[];
  readonly totals: {
    readonly gross: string;
    readonly discount: string;
    readonly subtotal: string;
    readonly tax: string;
    readonly total: string;
  };
}

export interface OperationOptions {
  readonly customers: readonly CustomerOption[];
  readonly products: readonly ProductOption[];
  readonly locations: readonly LocationOption[];
  readonly paymentMethods: readonly PaymentMethod[];
}
