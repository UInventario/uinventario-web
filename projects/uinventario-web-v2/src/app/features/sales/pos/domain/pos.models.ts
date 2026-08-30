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
