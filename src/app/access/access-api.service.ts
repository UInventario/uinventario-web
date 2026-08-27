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
  'TENANT_MANAGE' | 'PRODUCTS_MANAGE' | 'SALES_MANAGE' | 'ACCESS_MANAGE' | InventoryPermission;

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

  createRole(name: string, permissions: InventoryPermission[]) {
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

  createUser(email: string, password: string, roleIds: string[], branchIds: string[]) {
    return this.http.post<ApiResponse<AccessUserData>>(
      `${this.config.apiBaseUrl()}/access/users`,
      { email, password, roleIds, branchIds },
      { withCredentials: true },
    );
  }

  updateUser(userId: string, roleIds: string[], branchIds: string[]) {
    return this.http.patch<ApiResponse<AccessUserData>>(
      `${this.config.apiBaseUrl()}/access/users/${userId}`,
      { roleIds, branchIds },
      { withCredentials: true },
    );
  }
}
