export type ProductBaseUnit =
  'UNIT' | 'KILOGRAM' | 'GRAM' | 'LITER' | 'MILLILITER' | 'METER' | 'CENTIMETER';

export interface PosProduct {
  readonly id: string;
  readonly name: string;
  readonly sku: string;
  readonly barcode: string | null;
  readonly withoutCode: boolean;
  readonly stockBehavior: 'TRACKED' | 'UNTRACKED';
  readonly taxBehavior: 'STANDARD' | 'EXEMPT';
  readonly baseUnit: ProductBaseUnit;
  readonly quantityPrecision: number;
  readonly quantityRounding: 'HALF_UP' | 'DOWN' | 'UP';
  readonly minimumQuantity: string;
  readonly trackLots: boolean;
  readonly trackSerials: boolean;
  readonly price: string;
  readonly active: boolean;
  readonly sellable: boolean;
}

export interface PosProductPage {
  readonly products: readonly PosProduct[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

export interface PosCartLine {
  readonly product: PosProduct;
  readonly quantity: string;
  readonly note?: string;
  readonly manualUnitPrice?: string;
  readonly priceOverrideReason?: string;
}

export interface PosCartRequest {
  readonly lines: readonly {
    readonly productId: string;
    readonly quantity: string;
    readonly note?: string;
    readonly manualUnitPrice?: string;
    readonly priceOverrideReason?: string;
  }[];
}

export interface PosCartQuote {
  readonly context: {
    readonly branch: { readonly id: string; readonly name: string };
    readonly warehouse: { readonly id: string; readonly name: string };
    readonly cashRegister: { readonly id: string; readonly name: string; readonly code: string };
  };
  readonly currency: string;
  readonly taxRate: string;
  readonly lines: readonly PosQuotedLine[];
  readonly totals: {
    readonly gross: string;
    readonly lineDiscount: string;
    readonly promotionDiscount: string;
    readonly saleDiscount: string;
    readonly discount: string;
    readonly subtotal: string;
    readonly tax: string;
    readonly total: string;
    readonly payable?: string;
  };
}

export interface PosQuotedLine {
  readonly product: Pick<
    PosProduct,
    | 'id'
    | 'name'
    | 'sku'
    | 'withoutCode'
    | 'stockBehavior'
    | 'taxBehavior'
    | 'baseUnit'
    | 'quantityPrecision'
    | 'minimumQuantity'
  >;
  readonly quantity: string;
  readonly note: string | null;
  readonly availableQuantity: string;
  readonly unitPrice: string;
  readonly priceSource: 'BASE' | 'PRICE_LIST' | 'MANUAL';
  readonly priceOverrideReason: string | null;
  readonly priceList: { readonly id: string; readonly name: string } | null;
  readonly grossTotal: string;
  readonly subtotal: string;
  readonly tax: string;
  readonly total: string;
}

export interface CashRegisterShift {
  readonly id: string;
  readonly status: 'OPEN';
  readonly branch: { readonly id: string; readonly name: string };
  readonly cashRegister: { readonly id: string; readonly name: string; readonly code: string };
  readonly openedBy: { readonly id: string; readonly email: string };
  readonly openingAmount: string;
  readonly currency: string;
  readonly openedAt: string;
}

export type PosPaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'VOUCHER';

export interface PosPaymentOptions {
  readonly methods: readonly PosPaymentMethod[];
  readonly nonCashProvider: string;
}

export interface PosCustomer {
  readonly id: string;
  readonly name: string;
  readonly identifier: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly active: boolean;
  readonly privacyStatus: 'ACTIVE' | 'ANONYMIZED';
  readonly credit: {
    readonly enabled: boolean;
    readonly limit: string;
    readonly currency: string;
    readonly maxInstallments: number;
    readonly balance: string;
    readonly available: string;
    readonly overdueAmount: string;
    readonly status: 'DISABLED' | 'AVAILABLE' | 'LIMIT_REACHED' | 'OVERDUE';
  } | null;
}

export interface PosCustomerPage {
  readonly customers: readonly PosCustomer[];
  readonly pagination: PosProductPage['pagination'];
}

export interface SalePaymentInput {
  readonly method: PosPaymentMethod;
  readonly amount?: string;
  readonly amountReceived?: string;
  readonly reference?: string;
  readonly terminalOperationId?: string;
}

export interface CreateSaleInput extends PosCartRequest {
  readonly customerId?: string;
  readonly payment?: SalePaymentInput;
  readonly payments?: readonly SalePaymentInput[];
  readonly credit?: { readonly installmentCount: number };
}

export interface CreateCashSaleInput extends PosCartRequest {
  readonly customerId?: string;
  readonly cashReceived: string;
}

export interface PosSale {
  readonly id: string;
  readonly receiptNumber: string;
  readonly status: 'COMPLETED' | 'VOIDED';
  readonly currency: string;
  readonly customer: { readonly id: string; readonly name: string } | null;
  readonly totals: PosCartQuote['totals'];
  readonly payments: readonly {
    readonly id: string;
    readonly method: PosPaymentMethod | 'CREDIT';
    readonly status: 'COMPLETED' | 'PENDING' | 'REVERSED';
    readonly amountReceived: string;
    readonly amountApplied: string;
    readonly change: string;
    readonly reference: string | null;
    readonly provider: string;
    readonly authorizationCode: string | null;
  }[];
  readonly credit: {
    readonly accountId: string;
    readonly originalAmount: string;
    readonly balance: string;
    readonly currency: string;
    readonly termDays: number;
    readonly status: 'OPEN' | 'OVERDUE' | 'PAID' | 'CANCELLED';
    readonly dueDate: string;
    readonly installments: readonly {
      readonly number: number;
      readonly dueDate: string;
      readonly amount: string;
    }[];
  } | null;
  readonly createdAt: string;
}

export type PaymentTerminalScenario = 'SUCCESS' | 'REJECT' | 'INDETERMINATE';
export type PaymentTerminalStatus =
  'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'DECLINED' | 'INDETERMINATE' | 'CANCELLED';

export interface PaymentTerminalOperation {
  readonly id: string;
  readonly provider: string;
  readonly amount: string;
  readonly currency: string;
  readonly status: PaymentTerminalStatus;
  readonly errorCode: string | null;
  readonly authorizationCode: string | null;
  readonly queryCount: number;
  readonly saleId: string | null;
  readonly updatedAt: string;
}

export interface StartPaymentTerminalInput {
  readonly amount: string;
  readonly currency: string;
  readonly scenario: PaymentTerminalScenario;
}
