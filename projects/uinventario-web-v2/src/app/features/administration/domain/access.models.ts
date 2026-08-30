export type OperationalPermission =
  | 'PRODUCTS_MANAGE'
  | 'SALES_MANAGE'
  | 'SALES_VOID'
  | 'SALES_RETURN'
  | 'SALES_DISCOUNT'
  | 'SALES_PRICE_OVERRIDE'
  | 'SALES_CREDIT'
  | 'SALE_REPRINT'
  | 'CASH_DRAWER_OPEN'
  | 'CASH_REGISTER_OPEN'
  | 'CASH_REGISTER_CLOSE'
  | 'CASH_REGISTER_MOVE'
  | 'AUDIT_VIEW'
  | 'AUDIT_EXPORT'
  | 'PRIVACY_MANAGE'
  | 'SUPPLIERS_MANAGE'
  | 'PURCHASE_ORDERS_MANAGE'
  | 'PURCHASE_ORDERS_APPROVE'
  | 'PURCHASE_RECEIPTS_OVERAGE'
  | 'INVENTORY_VIEW'
  | 'INVENTORY_ADJUST'
  | 'INVENTORY_TRANSFER'
  | 'INVENTORY_COUNT'
  | 'INVENTORY_APPROVE'
  | 'INVENTORY_VALUATION_MANAGE'
  | 'INVENTORY_EXPIRED_STOCK_OVERRIDE'
  | 'NOTIFICATIONS_VIEW'
  | 'NOTIFICATIONS_MANAGE';

export interface AccessRole {
  readonly id: string;
  readonly name: string;
  readonly permissions: readonly OperationalPermission[];
}

export interface AccessUser {
  readonly id: string;
  readonly email: string;
  readonly active: boolean;
  readonly roles: readonly AccessRole[];
  readonly branches: readonly { readonly id: string; readonly name: string }[];
  readonly cashRegisters: readonly AccessCashRegister[];
  readonly manageable: boolean;
}

export interface AccessCashRegister {
  readonly id: string;
  readonly name: string;
  readonly code: string;
}

export interface AccessBranch {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly cashRegisters: readonly AccessCashRegister[];
}

export interface AccessUserInput {
  readonly email: string;
  readonly password: string;
  readonly roleIds: readonly string[];
  readonly branchIds: readonly string[];
  readonly cashRegisterIds: readonly string[];
}

export type AccessUserAssignment = Omit<AccessUserInput, 'email' | 'password'>;

export interface AccessSnapshot {
  readonly roles: readonly AccessRole[];
  readonly users: readonly AccessUser[];
  readonly branches: readonly AccessBranch[];
}
