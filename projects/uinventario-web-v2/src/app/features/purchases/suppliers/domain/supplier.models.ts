export type SupplierStatus = 'ACTIVE' | 'INACTIVE' | 'ALL';

export interface Pagination {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface SupplierContact {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly role: string | null;
  readonly primary: boolean;
}

export interface Supplier {
  readonly id: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly countryCode: string;
  readonly identifierType: string;
  readonly taxIdentifier: string;
  readonly active: boolean;
  readonly version: number;
  readonly contacts: readonly SupplierContact[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SupplierContactInput {
  readonly name: string;
  readonly email?: string;
  readonly phone?: string;
  readonly role?: string;
  readonly primary: boolean;
}

export interface SupplierInput {
  readonly legalName: string;
  readonly tradeName?: string;
  readonly taxIdentifier: string;
  readonly contacts: readonly SupplierContactInput[];
}

export interface SupplierQuery {
  readonly q?: string;
  readonly status: SupplierStatus;
  readonly page: number;
  readonly pageSize: number;
}

export interface SupplierPage {
  readonly suppliers: readonly Supplier[];
  readonly pagination: Pagination;
}

export interface SupplierPrice {
  readonly id: string;
  readonly currency: string;
  readonly unitCost: string;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly createdAt: string;
}

export interface CatalogProductOption {
  readonly id: string;
  readonly name: string;
  readonly sku: string;
  readonly catalogCost: string;
  readonly catalogPrice: string;
  readonly baseUnit: string;
  readonly quantityPrecision: number;
  readonly minimumQuantity: string;
}

export interface SupplierProduct {
  readonly id: string;
  readonly supplier: { readonly id: string; readonly name: string };
  readonly product: CatalogProductOption;
  readonly supplierCode: string;
  readonly minimumQuantity: string | null;
  readonly active: boolean;
  readonly version: number;
  readonly prices: readonly SupplierPrice[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SupplierProductInput {
  readonly supplierId: string;
  readonly productId: string;
  readonly supplierCode: string;
  readonly currency: string;
  readonly unitCost: string;
  readonly minimumQuantity?: string;
  readonly validFrom: string;
  readonly validTo?: string;
}

export interface SupplierProductQuery {
  readonly supplierId: string;
  readonly q?: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface SupplierProductPage {
  readonly products: readonly SupplierProduct[];
  readonly pagination: Pagination;
}

export interface CatalogProductSearchPage {
  readonly products: readonly CatalogProductOption[];
  readonly pagination: Pagination;
}
