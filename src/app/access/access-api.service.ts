import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RuntimeConfigService } from '../core/runtime-config.service';

export const INVENTORY_PERMISSIONS = [
  'INVENTORY_VIEW',
  'INVENTORY_ADJUST',
  'INVENTORY_TRANSFER',
  'INVENTORY_COUNT',
  'INVENTORY_APPROVE',
] as const;

export type InventoryPermission = (typeof INVENTORY_PERMISSIONS)[number];
export type AppPermission =
  | 'TENANT_MANAGE'
  | 'PRODUCTS_MANAGE'
  | 'SALES_MANAGE'
  | 'SALES_VOID'
  | 'SALES_DISCOUNT'
  | 'SALE_REPRINT'
  | 'CASH_REGISTER_OPEN'
  | 'CASH_REGISTER_CLOSE'
  | 'CASH_REGISTER_MOVE'
  | 'ACCESS_MANAGE'
  | 'AUDIT_VIEW'
  | 'AUDIT_EXPORT'
  | 'SUPPLIERS_MANAGE'
  | 'PURCHASE_ORDERS_MANAGE'
  | 'PURCHASE_ORDERS_APPROVE'
  | 'PURCHASE_RECEIPTS_OVERAGE'
  | InventoryPermission;

export const OPERATIONAL_PERMISSIONS = [
  ...INVENTORY_PERMISSIONS,
  'SALES_MANAGE',
  'SALES_VOID',
  'SALES_DISCOUNT',
  'SALE_REPRINT',
  'CASH_REGISTER_OPEN',
  'CASH_REGISTER_CLOSE',
  'CASH_REGISTER_MOVE',
  'AUDIT_VIEW',
  'AUDIT_EXPORT',
  'SUPPLIERS_MANAGE',
  'PURCHASE_ORDERS_MANAGE',
  'PURCHASE_ORDERS_APPROVE',
  'PURCHASE_RECEIPTS_OVERAGE',
] as const satisfies readonly AppPermission[];

export interface AccessRoleData {
  id: string;
  name: string;
  permissions: AppPermission[];
}

export interface AccessUserData {
  id: string;
  email: string;
  roles: AccessRoleData[];
  branches: Array<{ id: string; name: string }>;
  cashRegisters?: Array<{ id: string; name: string; code: string; branchId: string }>;
  manageable: boolean;
}

interface ApiResponse<T> {
  data: T;
  meta: { apiVersion: '1' };
}

@Injectable({ providedIn: 'root' })
export class AccessApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  listRoles() {
    return this.http.get<ApiResponse<AccessRoleData[]>>(
      `${this.config.apiBaseUrl()}/access/roles`,
      {
        withCredentials: true,
      },
    );
  }

  createRole(name: string, permissions: AppPermission[]) {
    return this.http.post<ApiResponse<AccessRoleData>>(
      `${this.config.apiBaseUrl()}/access/roles`,
      { name, permissions },
      { withCredentials: true },
    );
  }

  listUsers() {
    return this.http.get<ApiResponse<AccessUserData[]>>(
      `${this.config.apiBaseUrl()}/access/users`,
      {
        withCredentials: true,
      },
    );
  }

  createUser(
    email: string,
    password: string,
    roleIds: string[],
    branchIds: string[],
    cashRegisterIds: string[],
  ) {
    return this.http.post<ApiResponse<AccessUserData>>(
      `${this.config.apiBaseUrl()}/access/users`,
      { email, password, roleIds, branchIds, cashRegisterIds },
      { withCredentials: true },
    );
  }

  updateUser(userId: string, roleIds: string[], branchIds: string[], cashRegisterIds: string[]) {
    return this.http.patch<ApiResponse<AccessUserData>>(
      `${this.config.apiBaseUrl()}/access/users/${userId}`,
      { roleIds, branchIds, cashRegisterIds },
      { withCredentials: true },
    );
  }
}
