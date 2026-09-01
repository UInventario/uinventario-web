export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'ALL';
export type ClassificationKind = 'categories' | 'brands';
export type ProductBaseUnit =
  'UNIT' | 'KILOGRAM' | 'GRAM' | 'LITER' | 'MILLILITER' | 'METER' | 'CENTIMETER';

export interface Product {
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
  readonly category: { readonly id: string; readonly name: string } | null;
  readonly brand: { readonly id: string; readonly name: string } | null;
  readonly cost: string;
  readonly price: string;
  readonly active: boolean;
  readonly version: number;
  readonly sellable: boolean;
  readonly parentProductId?: string | null;
  readonly variantAttributes?: readonly ProductVariantAttribute[];
  readonly variantValues?: readonly ProductVariantValue[];
  readonly variants?: readonly Product[];
  readonly kit?: ProductKit | null;
}

export interface ProductVariantAttribute {
  readonly name: string;
  readonly values: readonly string[];
}

export interface ProductVariantValue {
  readonly attribute: string;
  readonly value: string;
}

export interface ProductKit {
  readonly stockMode: 'DERIVED' | 'ASSEMBLED';
  readonly priceRule: 'FIXED' | 'COMPONENT_SUM';
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly components: readonly {
    readonly product: { readonly id: string; readonly name: string; readonly sku: string };
    readonly quantity: string;
  }[];
}

export interface UpdateProductVariantsInput {
  readonly version: number;
  readonly attributes: readonly ProductVariantAttribute[];
  readonly variants: readonly {
    readonly id?: string;
    readonly version?: number;
    readonly values: readonly string[];
    readonly sku: string;
    readonly barcode?: string;
    readonly cost: string;
    readonly price: string;
    readonly active: boolean;
  }[];
}

export interface UpdateProductKitInput {
  readonly version: number;
  readonly enabled: boolean;
  readonly stockMode?: ProductKit['stockMode'];
  readonly priceRule?: ProductKit['priceRule'];
  readonly effectiveFrom?: string;
  readonly effectiveTo?: string;
  readonly components?: readonly {
    readonly productId: string;
    readonly quantity: string;
  }[];
}

export interface ProductInput {
  readonly name: string;
  readonly sku?: string;
  readonly barcode?: string;
  readonly withoutCode: boolean;
  readonly stockBehavior: 'TRACKED' | 'UNTRACKED';
  readonly taxBehavior: 'STANDARD' | 'EXEMPT';
  readonly baseUnit: ProductBaseUnit;
  readonly quantityPrecision: number;
  readonly quantityRounding: 'HALF_UP' | 'DOWN' | 'UP';
  readonly minimumQuantity: string;
  readonly trackLots: boolean;
  readonly trackSerials: boolean;
  readonly categoryName?: string;
  readonly brandName?: string;
  readonly cost: string;
  readonly price: string;
}

export interface ProductQuery {
  readonly q?: string;
  readonly status: ProductStatus;
  readonly categoryId?: string;
  readonly brandId?: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface ProductPage {
  readonly products: readonly Product[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

export interface Classification {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly productCount: number;
}

export interface CatalogOptions {
  readonly categories: readonly { readonly id: string; readonly name: string }[];
  readonly brands: readonly { readonly id: string; readonly name: string }[];
}

export interface ProductImport {
  readonly id: string;
  readonly status: 'PREVIEWED' | 'CONFIRMED';
  readonly sourceFilename: string;
  readonly summary: {
    readonly rows: number;
    readonly creates: number;
    readonly updates: number;
    readonly unchanged: number;
    readonly errors: number;
  };
  readonly canConfirm: boolean;
  readonly rows: readonly ProductImportRow[];
}

export interface ProductImportRow {
  readonly id: string;
  readonly rowNumber: number;
  readonly action: 'CREATE' | 'UPDATE' | 'UNCHANGED' | 'ERROR';
  readonly name: string;
  readonly sku: string;
  readonly barcode: string | null;
  readonly cost: string | null;
  readonly price: string | null;
  readonly errors: readonly { readonly code: string; readonly message: string }[];
}
